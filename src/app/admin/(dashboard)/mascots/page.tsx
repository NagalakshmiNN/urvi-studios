import { getMascotSettings, getAllMascotMessages } from "@/app/actions/mascot";
import MascotAdmin from "./MascotAdmin";

export default async function AdminMascotsPage() {
  const settings = await getMascotSettings();
  const messages = await getAllMascotMessages();

  return (
    <>
      <h1 style={{ margin: "0 0 8px" }}>Mascot Settings</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
        Manage the walking mascots that appear on your website. Toggle them on/off, change images, and edit speech-bubble messages.
      </p>
      <MascotAdmin initialSettings={settings} initialMessages={messages} />
    </>
  );
}
