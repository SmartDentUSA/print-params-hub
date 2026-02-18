import DraLIA from "@/components/DraLIA";

export default function AgentEmbed() {
  return (
    <div className="w-full h-screen bg-white flex flex-col">
      <DraLIA embedded={true} />
    </div>
  );
}
