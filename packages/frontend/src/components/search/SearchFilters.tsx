import { Select, SelectOption } from '@/components/ui/select';
import { DateRangePicker } from './DateRangePicker';
import { useUsers } from '@/hooks/useUsers';
import { useChannels } from '@/hooks/useChannels';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchFiltersProps {
  userId: string;
  channelId: string;
  startDate: string;
  endDate: string;
  onUserChange: (userId: string) => void;
  onChannelChange: (channelId: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function SearchFilters({
  userId,
  channelId,
  startDate,
  endDate,
  onUserChange,
  onChannelChange,
  onStartDateChange,
  onEndDateChange,
}: SearchFiltersProps) {
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: channels, isLoading: channelsLoading } = useChannels();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">User</label>
        {usersLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={userId} onChange={(e) => onUserChange(e.target.value)}>
            <SelectOption value="">All users</SelectOption>
            {users?.map((user) => (
              <SelectOption key={user.id} value={user.id.toString()}>
                {user.name}
              </SelectOption>
            ))}
          </Select>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">Channel</label>
        {channelsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={channelId} onChange={(e) => onChannelChange(e.target.value)}>
            <SelectOption value="">All channels</SelectOption>
            {channels?.map((channel) => (
              <SelectOption key={channel.id} value={channel.channelId}>
                #{channel.name}
              </SelectOption>
            ))}
          </Select>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">Date Range</label>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
      </div>
    </div>
  );
}
