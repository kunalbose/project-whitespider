"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { supabase } from "@/lib/supabase";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";

export default function ClientSelector() {
  const { clients, selectedClientID, setClients, setSelectedClientID } = useDashboardStore();

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from("clients").select("*");
      setClients(data || []);
    };
    fetchClients();
  }, [setClients]);


  return (
    <Select value={selectedClientID ?? ""} onValueChange={setSelectedClientID}>
       
      <SelectTrigger className="w-48">
        {clients.find((c) => c.id === selectedClientID)?.name || "Select Client"}
       </SelectTrigger>
      <SelectContent>
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id}>
            {client.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
