"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { supabase } from "@/lib/supabase";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";

export default function ClientSequencerSelector() {
  const { selectedClientID, clientSequencers, selectedClientSequencerID, setClientSequencer, setSelectedClientSequencerID } = useDashboardStore();

  useEffect(() => {
    const fetchClients = async () => {
        if (!selectedClientID) {
            const { data } = await supabase.from("client_sequencers").select("*");
            setClientSequencer(data || []);
        } else {
            const { data } = await supabase.from("client_sequencers").select("*").eq("client_id", selectedClientID);
            setClientSequencer(data || []);
        }
    };
    fetchClients();
  }, [setClientSequencer, selectedClientID]);


  return (
    <Select value={selectedClientSequencerID ?? ""} onValueChange={setSelectedClientSequencerID}>
       
      <SelectTrigger className="w-48">
        {clientSequencers.find((c) => c.id === selectedClientSequencerID)?.workspace_name || "Select Client Workspace"}
       </SelectTrigger>
      <SelectContent>
        {clientSequencers.map((clientSq) => (
          <SelectItem key={clientSq.id} value={clientSq.id}>
            {clientSq.workspace_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}