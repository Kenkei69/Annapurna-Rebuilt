import React from "react";
import { TrackingClient } from "./TrackingClient";

export const metadata = {
  title: "Consignment Tracking — Annapurna Rebuilt",
  description: "Public real-time cold-chain tracking and verified temperature telemetry.",
};

export default function TrackingPage() {
  return <TrackingClient />;
}
