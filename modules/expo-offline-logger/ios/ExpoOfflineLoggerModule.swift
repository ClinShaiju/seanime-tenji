import Darwin
import ExpoModulesCore
import Foundation
import UIKit

private enum ExpoOfflineLoggerStorage {
  private static let directoryName = "seanime-offline-logger"
  private static let logsFileName = "native.log"
  private static let crashFileName = "last-native-crash.log"
  private static let pendingSignalFileName = "pending-native-signal.log"

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

  private static func pendingSignalURL() -> URL? {
    directoryURL()?.appendingPathComponent(pendingSignalFileName)
  }

  /// Turns the raw marker left by the async-signal-safe signal handler into a
  /// readable crash record. Runs at install time (next launch), where Foundation
  /// formatting is safe again.
  static func finalizePendingSignalCrash() {
    guard let fileURL = pendingSignalURL() else {
      return
    }

    if let pending = try? String(contentsOf: fileURL, encoding: .utf8) {
      let trimmed = pending.trimmingCharacters(in: .whitespacesAndNewlines)
      if !trimmed.isEmpty {
        let crash = """
        timestamp=\(expoOfflineLoggerTimestamp())
        note=signal crash from a previous launch, recorded at next start
        \(trimmed)
        """
        writeCrash(crash)
      }
    }

    try? FileManager.default.removeItem(at: fileURL)
  }

  /// Pre-opens the file descriptor the signal handler writes to, so the handler
  /// itself only needs write(2).
  static func openPendingSignalFileDescriptor() -> Int32 {
    guard let fileURL = pendingSignalURL() else {
      return -1
    }

    return open(fileURL.path, O_WRONLY | O_CREAT | O_TRUNC, 0o644)
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

/// File descriptor pre-opened at install time for the signal handler (write(2) only).
private var expoOfflineLoggerSignalCrashFD: Int32 = -1
/// Set by the uncaught-exception handler so the SIGABRT that follows abort() does not
/// clobber the rich NSException record with a signal one-liner.
private var expoOfflineLoggerExceptionRecorded: Int32 = 0

private func expoOfflineLoggerExceptionHandler(_ exception: NSException) {
  expoOfflineLoggerExceptionRecorded = 1
  let crash = """
  timestamp=\(expoOfflineLoggerTimestamp())
  type=\(exception.name.rawValue)
  message=\(exception.reason ?? "")
  stack=\(exception.callStackSymbols.joined(separator: "\n"))
  """
  ExpoOfflineLoggerStorage.writeCrash(crash)
}

private func expoOfflineLoggerSignalMessage(_ signalNumber: Int32) -> StaticString {
  switch signalNumber {
  case SIGABRT: return "signal=6 SIGABRT\n"
  case SIGILL: return "signal=4 SIGILL\n"
  case SIGSEGV: return "signal=11 SIGSEGV\n"
  case SIGFPE: return "signal=8 SIGFPE\n"
  case SIGBUS: return "signal=10 SIGBUS\n"
  case SIGPIPE: return "signal=13 SIGPIPE\n"
  default: return "signal=unknown\n"
  }
}

private func expoOfflineLoggerSignalHandler(_ signalNumber: Int32) {
  // Async-signal-safe: no allocation, no Foundation — only write(2) of a static
  // message to a pre-opened fd. Formatting happens on the next launch.
  if expoOfflineLoggerExceptionRecorded == 0 {
    let fd = expoOfflineLoggerSignalCrashFD
    if fd >= 0 {
      let message = expoOfflineLoggerSignalMessage(signalNumber)
      message.withUTF8Buffer { buffer in
        _ = write(fd, buffer.baseAddress, buffer.count)
      }
    }
  }
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
    ExpoOfflineLoggerStorage.finalizePendingSignalCrash()
    expoOfflineLoggerSignalCrashFD = ExpoOfflineLoggerStorage.openPendingSignalFileDescriptor()
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