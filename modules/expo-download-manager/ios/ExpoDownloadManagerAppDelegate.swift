import ExpoModulesCore
import UIKit

public class ExpoDownloadManagerAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    if identifier == ExpoDownloadManagerModule.backgroundSessionIdentifier {
      ExpoDownloadManagerModule.setBackgroundCompletionHandler(completionHandler)
    }
  }
}
