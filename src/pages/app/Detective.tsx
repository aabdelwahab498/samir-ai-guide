import ChatPanel from "@/components/chat/ChatPanel";
import { useTranslation } from "react-i18next";
export default function Detective() {
  const { t } = useTranslation();
  return <div className="h-screen"><ChatPanel mode="detective" title={t("chat.detectiveTitle")} subtitle={t("chat.detectiveSubtitle")} /></div>;
}