import Darwin
import ExpoModulesCore
import Foundation
import UIKit

private enum ExpoOfflineLoggerStorage {
  private static let directoryName = "seanime-offline-logger"
  private static let logsFileName = "native.log"
  private static let crashFileName = "last-native-crash.log"

  private static func directoryURL() -> URL? {
    guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
      return nil
    }

    let directoryURL = documentsURL.appendingPathComponent(directoryName, isDirectory: true)
    try? FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
    return directoryURL
  }

  private static func logsURL() -> URL? {
    directoryURL()?.appendingPathComponent(logsFileName)
  }

  private static func crashURL() -> URL? {
    directoryURL()?.appendingPathComponent(crashFileName)
  }

  static func append(_ entry: String) {
    guard let fileURL = logsURL(), let data = (entry + "\n").data(using: .utf8) else {
      return
    }

    if FileManager.default.fileExists(atPath: fileURL.path), let handle = try? FileHandle(forWritingTo: fileURL) {
      handle.seekToEndOfFile()
      handle.write(data)
      handle.closeFile()
      return
    }

    try? data.write(to: fileURL)
  }

  static func readLogs() -> String? {
    guard let fileURL = logsURL(), FileManager.default.fileExists(atPath: fileURL.path) else {
      return nil
    }

    return try? String(contentsOf: fileURL, encoding: .utf8)
  }

  static func writeCrash(_ body: String) {
    guard let fileURL = crashURL() else {
      return
    }

    try? body.write(to: fileURL, atomically: true, encoding: .utf8)
  }

  static func readCrash() -> String? {
    guard let fileURL = crashURL(), FileManager.default.fileExists(atPath: fileURL.path) else {
      return nil
    }

    return try? String(contentsOf: fileURL, encoding: .utf8)
  }

  static func clearLogs() {
    guard let fileURL = logsURL() else {
      return
    }

    try? FileManager.default.removeItem(at: fileURL)
  }

  static func clearCrash() {
    guard let fileURL = crashURL() else {
      return
    }

    try? FileManager.default.removeItem(at: fileURL)
  }
}

private func expoOfflineLoggerTimestamp() -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter.string(from: Date())
}

private func expoOfflineLoggerExceptionHandler(_ exception: NSException) {
  let crash = """
  timestamp=\(expoOfflineLoggerTimestamp())
  type=\(exception.name.rawValue)
  message=\(exception.reason ?? "")
  stack=\(exception.callStackSymbols.joined(separator: "\n"))
  """
  ExpoOfflineLoggerStorage.writeCrash(crash)
}

private func expoOfflineLoggerSignalHandler(_ signalNumber: Int32) {
  let crash = """
  timestamp=\(expoOfflineLoggerTimestamp())
  signal=\(signalNumber)
  """
  ExpoOfflineLoggerStorage.writeCrash(crash)
  signal(signalNumber, SIG_DFL)
  raise(signalNumber)
}

public class ExpoOfflineLoggerModule: Module {
  private static var installed = false

  public func definition() -> ModuleDefinition {
    Name("ExpoOfflineLogger")

    Function("install") { () -> Bool in
      Self.installCrashHandlers()
    }

    Function("append") { (entryJson: String) in
      ExpoOfflineLoggerStorage.append(entryJson)
    }

    AsyncFunction("readNativeLogs") { () -> String? in
      ExpoOfflineLoggerStorage.readLogs()
    }

    AsyncFunction("getLastNativeCrash") { () -> String? in
      ExpoOfflineLoggerStorage.readCrash()
    }

    Function("clear") {
      ExpoOfflineLoggerStorage.clearLogs()
    }

    Function("clearLastNativeCrash") {
      ExpoOfflineLoggerStorage.clearCrash()
    }

    Function("copyToClipboard") { (text: String) -> Bool in
      UIPasteboard.general.string = text
      return true
    }
  }

  private static func installCrashHandlers() -> Bool {
    if installed {
      return false
    }

    installed = true
    NSSetUncaughtExceptionHandler(expoOfflineLoggerExceptionHandler)
    signal(SIGABRT, expoOfflineLoggerSignalHandler)
    signal(SIGILL, expoOfflineLoggerSignalHandler)
    signal(SIGSEGV, expoOfflineLoggerSignalHandler)
    signal(SIGFPE, expoOfflineLoggerSignalHandler)
    signal(SIGBUS, expoOfflineLoggerSignalHandler)
    signal(SIGPIPE, expoOfflineLoggerSignalHandler)
    return true
  }
}