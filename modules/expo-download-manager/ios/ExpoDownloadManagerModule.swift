/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Inspired by and/or derived from Streamyfin (https://github.com/streamyfin/streamyfin).
 * Copyright (c) the original authors and Seanime Tenji contributors.
 */

import ExpoModulesCore
import Foundation

enum ExpoDownloadManagerError: Error {
  case invalidURL
  case missingSession
}

struct ExpoDownloadTaskInfo: Codable {
  let id: String
  let url: String
  let destinationPath: String
  let headers: [String: String]
  let title: String?
}

final class ExpoDownloadSessionDelegate: NSObject, URLSessionDownloadDelegate {
  weak var module: ExpoDownloadManagerModule?

  init(module: ExpoDownloadManagerModule) {
    self.module = module
    super.init()
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    module?.handleProgress(
      taskId: downloadTask.taskIdentifier,
      downloadTask: downloadTask,
      bytesWritten: totalBytesWritten,
      totalBytes: totalBytesExpectedToWrite
    )
  }

  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    module?.handleDownloadComplete(
      taskId: downloadTask.taskIdentifier,
      location: location,
      downloadTask: downloadTask
    )
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard let error else { return }
    module?.handleError(taskId: task.taskIdentifier, task: task, error: error)
  }

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    DispatchQueue.main.async {
      if let completion = ExpoDownloadManagerModule.backgroundCompletionHandler {
        completion()
        ExpoDownloadManagerModule.backgroundCompletionHandler = nil
      }
    }
  }
}

public class ExpoDownloadManagerModule: Module {
  static let backgroundSessionIdentifier = "app.seanime.tenji.expo-download-manager"
  fileprivate static var backgroundCompletionHandler: (() -> Void)?

  private var session: URLSession?
  private var sessionDelegate: ExpoDownloadSessionDelegate?
  // All access to the four collections below must go through stateQueue: they are
  // mutated from both the URLSession delegate queue and the Expo JS-call contexts.
  private let stateQueue = DispatchQueue(label: "app.seanime.tenji.expo-download-manager.state")
  private var taskInfoByIdentifier: [Int: ExpoDownloadTaskInfo] = [:]
  private var taskIdentifiersByDownloadId: [String: Int] = [:]
  private var lastProgressTimeByIdentifier: [Int: Date] = [:]
  private var resumedTaskIdentifiers: Set<Int> = []

  public func definition() -> ModuleDefinition {
    Name("ExpoDownloadManager")

    Events(
      "onDownloadProgress",
      "onDownloadComplete",
      "onDownloadError",
      "onDownloadStarted"
    )

    OnCreate {
      self.initializeSession()
    }

    AsyncFunction("startDownload") { (
      id: String,
      urlString: String,
      destinationPath: String,
      headers: [String: String]?,
      title: String?
    ) -> Int in
      let existingTaskId = self.stateQueue.sync { self.taskIdentifiersByDownloadId[id] }
      if let existingTaskId = existingTaskId {
        return existingTaskId
      }

      guard let url = URL(string: urlString) else {
        throw ExpoDownloadManagerError.invalidURL
      }

      if self.session == nil {
        self.initializeSession()
      }

      guard let session = self.session else {
        throw ExpoDownloadManagerError.missingSession
      }

      let info = ExpoDownloadTaskInfo(
        id: id,
        url: urlString,
        destinationPath: destinationPath,
        headers: headers ?? [:],
        title: title
      )

      let task: URLSessionDownloadTask
      var resumed = false
      if let resumeData = self.consumeResumeData(forDownloadId: id) {
        task = session.downloadTask(withResumeData: resumeData)
        resumed = true
      } else {
        task = self.freshDownloadTask(url: url, info: info, session: session)
      }

      let taskId = self.startTask(task, info: info, resumed: resumed)

      self.sendEvent("onDownloadStarted", [
        "id": info.id,
        "taskId": taskId,
        "url": info.url
      ])

      return taskId
    }

    Function("cancelDownload") { (taskId: Int) in
      self.session?.getAllTasks { tasks in
        for task in tasks where task.taskIdentifier == taskId {
          self.cancelProducingResumeData(task)
        }
      }
      self.cleanup(taskId: taskId)
    }

    Function("cancelDownloadById") { (id: String) in
      self.session?.getAllTasks { tasks in
        for task in tasks {
          guard self.info(for: task)?.id == id else { continue }
          self.cancelProducingResumeData(task)
        }
      }
      let taskId = self.stateQueue.sync { self.taskIdentifiersByDownloadId[id] }
      if let taskId = taskId {
        self.cleanup(taskId: taskId)
      }
    }

    Function("cancelAllDownloads") {
      self.session?.getAllTasks { tasks in
        for task in tasks {
          self.cancelProducingResumeData(task)
        }
      }
      self.stateQueue.sync {
        self.taskInfoByIdentifier.removeAll()
        self.taskIdentifiersByDownloadId.removeAll()
        self.lastProgressTimeByIdentifier.removeAll()
        self.resumedTaskIdentifiers.removeAll()
      }
    }

    AsyncFunction("getActiveDownloads") { () -> [[String: Any]] in
      guard let session = self.session else { return [] }

      return await withCheckedContinuation { (continuation: CheckedContinuation<[[String: Any]], Never>) in
        session.getAllTasks { tasks in
          let downloads = tasks.compactMap { task -> [String: Any]? in
            guard let info = self.info(for: task) else { return nil }
            return [
              "id": info.id,
              "taskId": task.taskIdentifier,
              "url": info.url,
              "destinationPath": info.destinationPath,
              "state": self.stateName(for: task.state)
            ]
          }
          continuation.resume(returning: downloads)
        }
      }
    }
  }

  func handleProgress(
    taskId: Int,
    downloadTask: URLSessionDownloadTask,
    bytesWritten: Int64,
    totalBytes: Int64
  ) {
    guard let info = info(for: downloadTask) else { return }

    let now = Date()
    let shouldEmit = stateQueue.sync { () -> Bool in
      let previous = lastProgressTimeByIdentifier[taskId] ?? .distantPast
      if now.timeIntervalSince(previous) < 0.5 && bytesWritten < totalBytes {
        return false
      }
      lastProgressTimeByIdentifier[taskId] = now
      return true
    }
    if !shouldEmit {
      return
    }

    let progress = totalBytes > 0 ? Double(bytesWritten) / Double(totalBytes) : 0

    sendEvent("onDownloadProgress", [
      "id": info.id,
      "taskId": taskId,
      "url": info.url,
      "bytesWritten": bytesWritten,
      "totalBytes": totalBytes,
      "progress": progress
    ])
  }

  func handleDownloadComplete(taskId: Int, location: URL, downloadTask: URLSessionDownloadTask) {
    guard let info = info(for: downloadTask) else {
      sendEvent("onDownloadError", [
        "id": "",
        "taskId": taskId,
        "url": "",
        "error": "Download task info not found"
      ])
      return
    }

    do {
      let destination = destinationURL(from: info.destinationPath)
      let directory = destination.deletingLastPathComponent()
      let fileManager = FileManager.default

      if fileManager.fileExists(atPath: destination.path) {
        try fileManager.removeItem(at: destination)
      }
      if !fileManager.fileExists(atPath: directory.path) {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)
      }

      try fileManager.moveItem(at: location, to: destination)

      sendEvent("onDownloadComplete", [
        "id": info.id,
        "taskId": taskId,
        "url": info.url,
        "filePath": info.destinationPath
      ])
      cleanup(taskId: taskId)
    } catch {
      sendEvent("onDownloadError", [
        "id": info.id,
        "taskId": taskId,
        "url": info.url,
        "error": "File operation failed: \(error.localizedDescription)"
      ])
      cleanup(taskId: taskId)
    }
  }

  func handleError(taskId: Int, task: URLSessionTask, error: Error) {
    let nsError = error as NSError
    let isCancelled = nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    let info = info(for: task)
    let wasResumed = stateQueue.sync { resumedTaskIdentifiers.contains(taskId) }

    if let info = info {
      if let resumeData = nsError.userInfo[NSURLSessionDownloadTaskResumeData] as? Data {
        // Pause (cancel-with-resume) or resumable failure: keep the bytes for next start.
        persistResumeData(resumeData, forDownloadId: info.id)
      } else if wasResumed, !isCancelled, let session = session, let url = URL(string: info.url) {
        // The resume attempt failed (stale/invalid resume data): retry once from scratch.
        cleanup(taskId: taskId)
        let retryTask = freshDownloadTask(url: url, info: info, session: session)
        _ = startTask(retryTask, info: info, resumed: false)
        return
      }
    }

    if let info = info, !isCancelled {
      sendEvent("onDownloadError", [
        "id": info.id,
        "taskId": taskId,
        "url": info.url,
        "error": error.localizedDescription
      ])
    }

    cleanup(taskId: taskId)
  }

  private func initializeSession() {
    let config = URLSessionConfiguration.background(withIdentifier: Self.backgroundSessionIdentifier)
    config.allowsCellularAccess = true
    config.sessionSendsLaunchEvents = true
    config.isDiscretionary = false
    config.httpMaximumConnectionsPerHost = 4
    config.timeoutIntervalForResource = 60 * 60 * 24 * 7

    sessionDelegate = ExpoDownloadSessionDelegate(module: self)
    session = URLSession(configuration: config, delegate: sessionDelegate, delegateQueue: nil)
  }

  private func info(for task: URLSessionTask) -> ExpoDownloadTaskInfo? {
    let taskId = task.taskIdentifier
    if let cached = stateQueue.sync(execute: { taskInfoByIdentifier[taskId] }) {
      return cached
    }

    guard let description = task.taskDescription,
          let data = description.data(using: .utf8),
          let info = try? JSONDecoder().decode(ExpoDownloadTaskInfo.self, from: data) else {
      return nil
    }

    stateQueue.sync {
      taskInfoByIdentifier[taskId] = info
      taskIdentifiersByDownloadId[info.id] = taskId
    }
    return info
  }

  private func encodeTaskInfo(_ info: ExpoDownloadTaskInfo) -> String? {
    guard let data = try? JSONEncoder().encode(info) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func destinationURL(from path: String) -> URL {
    if let url = URL(string: path), url.isFileURL {
      return url
    }
    return URL(fileURLWithPath: path)
  }

  private func cleanup(taskId: Int) {
    stateQueue.sync {
      if let info = taskInfoByIdentifier.removeValue(forKey: taskId) {
        taskIdentifiersByDownloadId.removeValue(forKey: info.id)
      }
      lastProgressTimeByIdentifier.removeValue(forKey: taskId)
      resumedTaskIdentifiers.remove(taskId)
    }
  }

  private func freshDownloadTask(url: URL, info: ExpoDownloadTaskInfo, session: URLSession) -> URLSessionDownloadTask {
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 300
    for (key, value) in info.headers {
      request.setValue(value, forHTTPHeaderField: key)
    }
    return session.downloadTask(with: request)
  }

  private func startTask(_ task: URLSessionDownloadTask, info: ExpoDownloadTaskInfo, resumed: Bool) -> Int {
    task.taskDescription = encodeTaskInfo(info)
    let taskId = task.taskIdentifier
    stateQueue.sync {
      taskInfoByIdentifier[taskId] = info
      taskIdentifiersByDownloadId[info.id] = taskId
      if resumed {
        resumedTaskIdentifiers.insert(taskId)
      }
    }
    task.resume()
    return taskId
  }

  private func cancelProducingResumeData(_ task: URLSessionTask) {
    if let downloadTask = task as? URLSessionDownloadTask {
      // Resume data also arrives in didCompleteWithError's userInfo, where it is persisted.
      downloadTask.cancel(byProducingResumeData: { _ in })
    } else {
      task.cancel()
    }
  }

  private func resumeDataURL(forDownloadId id: String) -> URL? {
    let fileManager = FileManager.default
    guard let cachesURL = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      return nil
    }
    let directory = cachesURL.appendingPathComponent("expo-download-manager-resume", isDirectory: true)
    try? fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
    guard let name = id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) else {
      return nil
    }
    return directory.appendingPathComponent(name + ".resumedata")
  }

  private func persistResumeData(_ data: Data, forDownloadId id: String) {
    guard let fileURL = resumeDataURL(forDownloadId: id) else { return }
    try? data.write(to: fileURL, options: .atomic)
  }

  private func consumeResumeData(forDownloadId id: String) -> Data? {
    guard let fileURL = resumeDataURL(forDownloadId: id),
          let data = try? Data(contentsOf: fileURL) else {
      return nil
    }
    // Consume up front so a failed resume falls back to a fresh request next time.
    try? FileManager.default.removeItem(at: fileURL)
    guard (try? PropertyListSerialization.propertyList(from: data, options: [], format: nil)) is [String: Any] else {
      return nil
    }
    return data
  }

  private func stateName(for state: URLSessionTask.State) -> String {
    switch state {
    case .running:
      return "running"
    case .canceling:
      return "canceling"
    case .completed:
      return "completed"
    case .suspended:
      return "suspended"
    @unknown default:
      return "unknown"
    }
  }

  static func setBackgroundCompletionHandler(_ handler: @escaping () -> Void) {
    backgroundCompletionHandler = handler
  }
}
