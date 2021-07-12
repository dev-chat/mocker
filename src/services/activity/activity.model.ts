export interface TimeBlock {
  time: string;
  date: TimeBlockDate;
}

export interface TimeBlockDate {
  day: number;
  month: number;
  year: number;
}
