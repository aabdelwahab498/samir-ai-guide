import ChatPanel from "@/components/chat/ChatPanel";
import { useTranslation } from "react-i18next";
export default function Tutor() {
  const { t } = useTranslation();
  return <div className="h-screen"><ChatPanel mode="tutor" title={t("chat.tutorTitle")} subtitle={t("chat.tutorSubtitle")} /></div>;
}