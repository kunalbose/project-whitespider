'use client';

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';


import DateRangeSelector from './DAteFilterSelector';

export default function DashboardFilters({
  setSelectedSequencer,
  
}: {
  setSelectedSequencer: (v: string) => void;
 
}) {


  return (
    <div className="flex space-x-4">
      <Select onValueChange={setSelectedSequencer} defaultValue="Instantly">
        <SelectTrigger>Sequencers</SelectTrigger>
        <SelectContent>
          <SelectItem value="SmartLead">SmartLead</SelectItem>
        </SelectContent>
      </Select>
      <DateRangeSelector/>
      
    </div>
  );
}
