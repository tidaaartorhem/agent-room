import RoomView from "@/components/RoomView";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomView roomId={roomId} />;
}
