"use client";

import { useParams } from "next/navigation";
import { OnlineGame } from "@/components/game/OnlineGame";

export default function OnlineGamePage() {
  const params = useParams<{ code: string }>();
  return <OnlineGame code={String(params?.code ?? "").toUpperCase()} tv={false} />;
}
