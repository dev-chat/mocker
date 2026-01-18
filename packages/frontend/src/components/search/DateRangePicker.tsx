import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="pl-9"
          placeholder="Start date"
        />
      </div>
      <div className="relative flex-1">
        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="pl-9"
          placeholder="End date"
        />
      </div>
    </div>
  );
}
