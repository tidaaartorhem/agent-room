import WorkspaceShell from "@/components/slack/WorkspaceShell";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <WorkspaceShell initialRoomId={roomId} />;
}
