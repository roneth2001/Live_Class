import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-4">
      <h1 className="text-4xl font-bold mb-4">Online Live Classroom</h1>
      <p className="text-gray-400 mb-8">Start streaming your class or join via link instantly.</p>

      <Link 
        href="/dashboard" 
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}