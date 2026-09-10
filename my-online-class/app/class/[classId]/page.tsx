"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type {
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

export default function ClassRoom() {
  const { classId } = useParams();
  const searchParams = useSearchParams();
  const isTeacher = searchParams.get("role") === "teacher";
  const clientRef = useRef<any>(null);

  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localTracks, setLocalTracks] = useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const [screenTrack, setScreenTrack] = useState<any>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLDivElement>(null);
  const shareableLink = typeof window !== "undefined" ? `${window.location.origin}/class/${classId}` : "";

  useEffect(() => {
    let isActive = true;
    let client: any = null;

    const initClass = async () => {
      if (typeof window === "undefined" || !APP_ID || !classId) return;

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
        await client.subscribe(user, mediaType);
        if (!isActive) return;

        if (mediaType === "video") {
          setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      };

      const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
        if (!isActive) return;
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      };

      client.on("user-published", handleUserPublished);
      client.on("user-unpublished", handleUserUnpublished);

      try {
        await client.join(APP_ID, String(classId), null, null);
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();

        if (!isActive) {
          tracks[0].close();
          tracks[1].close();
          return;
        }

        setLocalTracks(tracks);

        if (localVideoRef.current) {
          tracks[1].play(localVideoRef.current);
        }

        await client.publish(tracks);
      } catch (error: any) {
        const message = error?.message || "";
        const code = error?.code || "";

        if (code === "OPERATION_ABORTED" || message.includes("cancel token canceled")) {
          return;
        }

        console.error("Failed to join class:", error);
      }
    };

    initClass();

    return () => {
      isActive = false;
      if (client) {
        client.off("user-published", () => undefined);
        client.off("user-unpublished", () => undefined);
      }

      screenTrack?.close?.();
      localTracks?.[0].close();
      localTracks?.[1].close();
      setLocalTracks(null);
      client?.leave?.().catch(() => undefined);
    };
  }, [classId]);

  // For students: play the first available remote video (teacher/screen) in the main view
  useEffect(() => {
    if (isTeacher) return;
    const node = mainVideoRef.current;
    if (!node) return;

    const presenter = remoteUsers.find((u) => !!u.videoTrack);
    if (presenter && presenter.videoTrack) {
      try {
        presenter.videoTrack.play(node);
      } catch (e) {
        // ignore play errors (race conditions)
      }
    }

    return () => {
      // clear node when presenter changes or component unmounts
      if (node) node.innerHTML = "";
    };
  }, [remoteUsers, isTeacher]);

  const toggleMute = () => {
    if (localTracks) {
      const nextState = !isMuted;
      localTracks[0].setEnabled(nextState);
      setIsMuted(nextState);
    }
  };

  const toggleCamera = () => {
    if (!localTracks) return;

    const nextState = !cameraEnabled;
    localTracks[1].setEnabled(nextState);
    setCameraEnabled(nextState);
  };

  const toggleScreenShare = async () => {
    const client = clientRef.current;
    if (!localTracks || !isTeacher || !client) return;

    if (isScreenSharing && screenTrack) {
      await client.unpublish(screenTrack);
      screenTrack.close();
      setScreenTrack(null);
      setIsScreenSharing(false);

      localTracks[1].setEnabled(cameraEnabled);
      if (localVideoRef.current) {
        localTracks[1].play(localVideoRef.current);
      }
      await client.publish(localTracks[1]);
      return;
    }

    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
    await client.unpublish(localTracks[1]);
    localTracks[1].setEnabled(false);
    setCameraEnabled(false);

    const shareTrack = await AgoraRTC.createScreenVideoTrack({ encoderConfig: "1080p_1" }, "auto");
    const finalTrack = Array.isArray(shareTrack) ? shareTrack[0] : shareTrack;

    if (finalTrack && localVideoRef.current) {
      finalTrack.play(localVideoRef.current);
    }

    await client.publish(finalTrack);
    setScreenTrack(finalTrack);
    setIsScreenSharing(true);
  };

  const endClass = async () => {
    const client = clientRef.current;
    if (screenTrack) {
      await client?.unpublish?.(screenTrack);
      screenTrack.close();
    }

    if (localTracks) {
      localTracks[0].close();
      localTracks[1].close();
    }

    await client?.leave?.();
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <div className="flex-1 flex flex-col p-4">
        <div className="mb-4 flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-800 gap-3">
          <span className="font-semibold text-sm">{isTeacher ? "Teacher View" : "Student View"}</span>
          <div className="flex gap-2 flex-wrap justify-end">
            <input 
              readOnly 
              value={shareableLink} 
              className="bg-gray-800 text-xs p-2 rounded w-64 text-gray-300 border border-gray-700" 
            />
            <button 
              onClick={() => navigator.clipboard.writeText(shareableLink)}
              className="bg-blue-600 hover:bg-blue-700 text-xs px-3 py-1 rounded font-medium transition"
            >
              Copy Link
            </button>
            {isTeacher && (
              <>
                <button
                  onClick={toggleScreenShare}
                  className="bg-violet-600 hover:bg-violet-700 text-xs px-3 py-1 rounded font-medium transition"
                >
                  {isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                </button>
                <button
                  onClick={toggleCamera}
                  className="bg-amber-500 hover:bg-amber-600 text-xs px-3 py-1 rounded font-medium transition text-black"
                >
                  {cameraEnabled ? "Stop Camera" : "Start Camera"}
                </button>
                <button
                  onClick={endClass}
                  className="bg-red-600 hover:bg-red-700 text-xs px-3 py-1 rounded font-medium transition"
                >
                  Finish Class
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-black rounded-lg overflow-hidden border border-gray-800">
            <div ref={isTeacher ? localVideoRef : mainVideoRef} className="w-full h-full object-cover" />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-gray-900/90 px-4 py-2 rounded-full border border-gray-700">
            <button 
              onClick={toggleMute}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold ${isMuted ? "bg-red-600" : "bg-gray-700 hover:bg-gray-600"}`}
            >
              {isMuted ? "Unmute Mic" : "Mute Mic"}
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 border-l border-gray-800 p-4 bg-gray-900 overflow-y-auto">
        <h3 className="text-xs font-semibold mb-4 text-gray-400 uppercase tracking-wider">
          Joined Students ({remoteUsers.length})
        </h3>

        <div className="flex flex-col gap-3">
          {remoteUsers.map((user) => (
            <div 
              key={user.uid} 
              id={`user-${user.uid}`} 
              className="h-40 bg-gray-950 rounded-lg overflow-hidden relative border border-gray-800"
              ref={(node) => {
                if (node && user.videoTrack) user.videoTrack.play(node);
              }}
            >
              <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-gray-300">
                User: {user.uid}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}