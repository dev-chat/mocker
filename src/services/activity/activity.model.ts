export interface TimeBlock {
  time: string;
  date: TimeBlockDate;
}

export interface TimeBlockDate {
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  year: number;
}

export interface Temperature {
  count: number;
  channel: string;
}
