"use client";
import { useState } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [title, setTitle] = useState("");
  const router = useRouter();

  const createClass = async () => {
    if (!title) return;
    const user = auth.currentUser;
    
    const docRef = await addDoc(collection(db, "classes"), {
      title,
      teacherId: user?.uid || "teacher_1",
      status: "live",
      createdAt: serverTimestamp(),
    });

    router.push(`/class/${docRef.id}?role=teacher`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Live Class</h1>
        <input
          type="text"
          placeholder="Class Title / Subject"
          className="border border-gray-700 bg-gray-800 p-3 w-full mb-4 rounded-lg focus:outline-none focus:border-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button 
          onClick={createClass}
          className="bg-blue-600 hover:bg-blue-700 font-semibold text-white py-3 rounded-lg w-full transition"
        >
          Start Streaming
        </button>
      </div>
    </div>
  );
}