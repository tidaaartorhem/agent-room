import ChatView from "@/components/chat/ChatView";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <ChatView roomId={roomId} />;
}
