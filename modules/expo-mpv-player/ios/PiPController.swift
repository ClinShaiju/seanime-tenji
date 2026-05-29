import AVKit
import AVFoundation
import CoreMedia

protocol PiPControllerDelegate: AnyObject {
    func pipController(_ controller: PiPController, willStartPictureInPicture: Bool)
    func pipController(_ controller: PiPController, didStartPictureInPicture: Bool)
    func pipController(_ controller: PiPController, willStopPictureInPicture: Bool)
    func pipController(_ controller: PiPController, didStopPictureInPicture: Bool)
    func pipController(_ controller: PiPController, didTransitionToRenderSize renderSize: CMVideoDimensions)
    func pipController(_ controller: PiPController, restoreUserInterfaceForPictureInPictureStop completionHandler: @escaping (Bool) -> Void)
    func pipControllerPlay(_ controller: PiPController)
    func pipControllerPause(_ controller: PiPController)
    func pipController(_ controller: PiPController, skipByInterval interval: CMTime)
    func pipControllerIsPlaying(_ controller: PiPController) -> Bool
    func pipControllerDuration(_ controller: PiPController) -> Double
    func pipControllerCurrentPosition(_ controller: PiPController) -> Double
}

final class PiPController: NSObject {
    private var pipController: AVPictureInPictureController?
    private weak var sampleBufferDisplayLayer: AVSampleBufferDisplayLayer?

    weak var delegate: PiPControllerDelegate?

    // Timebase for PiP progress tracking
    private var timebase: CMTimebase?
    private var currentTime: CMTime = .zero
    private var currentDuration: Double = 0

    var isPictureInPictureSupported: Bool {
        return AVPictureInPictureController.isPictureInPictureSupported()
    }

    var isPictureInPictureActive: Bool {
        return pipController?.isPictureInPictureActive ?? false
    }

    init(sampleBufferDisplayLayer: AVSampleBufferDisplayLayer) {
        self.sampleBufferDisplayLayer = sampleBufferDisplayLayer
        super.init()
        setupTimebase()
        setupPictureInPicture()
    }

    private func setupTimebase() {
        var newTimebase: CMTimebase?
        let status = CMTimebaseCreateWithSourceClock(
            allocator: kCFAllocatorDefault,
            sourceClock: CMClockGetHostTimeClock(),
            timebaseOut: &newTimebase
        )

        if status == noErr, let tb = newTimebase {
            timebase = tb
            CMTimebaseSetTime(tb, time: .zero)
            CMTimebaseSetRate(tb, rate: 0)
            sampleBufferDisplayLayer?.controlTimebase = tb
        }
    }

    private func setupPictureInPicture() {
        guard isPictureInPictureSupported else {
            print("[PiPController] setupPictureInPicture: PiP not supported (isPictureInPictureSupported=false)")
            return
        }
        guard let displayLayer = sampleBufferDisplayLayer else {
            print("[PiPController] setupPictureInPicture: displayLayer is nil")
            return
        }

        let contentSource = AVPictureInPictureController.ContentSource(
            sampleBufferDisplayLayer: displayLayer,
            playbackDelegate: self
        )

        pipController = AVPictureInPictureController(contentSource: contentSource)
        pipController?.delegate = self
        pipController?.requiresLinearPlayback = false
        pipController?.canStartPictureInPictureAutomaticallyFromInline = true
        print("[PiPController] setupPictureInPicture: controller created, isPossible=\(pipController?.isPictureInPicturePossible ?? false)")
    }

    @discardableResult
    func startPictureInPicture() -> Bool {
        guard let pipController = pipController else {
            print("[PiPController] startPictureInPicture: pipController is nil (setup failed)")
            return false
        }
        guard pipController.isPictureInPicturePossible else {
            print("[PiPController] startPictureInPicture: isPictureInPicturePossible=false")
            return false
        }
        print("[PiPController] startPictureInPicture: starting PiP")
        pipController.startPictureInPicture()
        return true
    }

    func stopPictureInPicture() {
        pipController?.stopPictureInPicture()
    }

    func updatePlaybackState() {
        guard isPictureInPictureActive else { return }
        if Thread.isMainThread {
            pipController?.invalidatePlaybackState()
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.pipController?.invalidatePlaybackState()
            }
        }
    }

    func setCurrentTime(_ time: CMTime) {
        currentTime = time
        if let tb = timebase {
            CMTimebaseSetTime(tb, time: time)
        }
        if isPictureInPictureActive {
            updatePlaybackState()
        }
    }

    func setCurrentTimeFromSeconds(_ seconds: Double, duration: Double) {
        guard seconds >= 0 else { return }
        currentDuration = duration
        let time = CMTime(seconds: seconds, preferredTimescale: 1000)
        setCurrentTime(time)
    }

    func setPlaybackRate(_ rate: Float) {
        if let tb = timebase {
            CMTimebaseSetRate(tb, rate: Float64(rate))
        }
    }
}

// MARK: - AVPictureInPictureControllerDelegate

extension PiPController: AVPictureInPictureControllerDelegate {
    func pictureInPictureControllerWillStartPictureInPicture(_ controller: AVPictureInPictureController) {
        delegate?.pipController(self, willStartPictureInPicture: true)
    }

    func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
        delegate?.pipController(self, didStartPictureInPicture: true)
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController, failedToStartPictureInPictureWithError error: Error) {
        print("[PiPController] Failed to start PiP: \(error)")
        delegate?.pipController(self, didStartPictureInPicture: false)
    }

    func pictureInPictureControllerWillStopPictureInPicture(_ controller: AVPictureInPictureController) {
        delegate?.pipController(self, willStopPictureInPicture: true)
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
        delegate?.pipController(self, didStopPictureInPicture: true)
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController, restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
        delegate?.pipController(self, restoreUserInterfaceForPictureInPictureStop: completionHandler)
    }
}

// MARK: - AVPictureInPictureSampleBufferPlaybackDelegate

extension PiPController: AVPictureInPictureSampleBufferPlaybackDelegate {
    func pictureInPictureController(_ controller: AVPictureInPictureController, setPlaying playing: Bool) {
        if playing {
            delegate?.pipControllerPlay(self)
        } else {
            delegate?.pipControllerPause(self)
        }
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController, didTransitionToRenderSize newRenderSize: CMVideoDimensions) {
        delegate?.pipController(self, didTransitionToRenderSize: newRenderSize)
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController, skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) {
        delegate?.pipController(self, skipByInterval: skipInterval)
        completionHandler()
    }

    var isPlaying: Bool {
        return delegate?.pipControllerIsPlaying(self) ?? false
    }

    var timeRangeForPlayback: CMTimeRange {
        let duration = delegate?.pipControllerDuration(self) ?? 0
        if duration > 0 {
            let cmDuration = CMTime(seconds: duration, preferredTimescale: 1000)
            return CMTimeRange(start: .zero, duration: cmDuration)
        }
        return CMTimeRange(start: .zero, duration: .positiveInfinity)
    }

    func pictureInPictureControllerTimeRangeForPlayback(_ controller: AVPictureInPictureController) -> CMTimeRange {
        return timeRangeForPlayback
    }

    func pictureInPictureControllerIsPlaybackPaused(_ controller: AVPictureInPictureController) -> Bool {
        return !isPlaying
    }

    func pictureInPictureController(_ controller: AVPictureInPictureController, setPlaying playing: Bool, completion: @escaping () -> Void) {
        if playing {
            delegate?.pipControllerPlay(self)
        } else {
            delegate?.pipControllerPause(self)
        }
        completion()
    }
}
