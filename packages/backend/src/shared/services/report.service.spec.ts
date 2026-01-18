import { ReportService } from './report.service';
import { ReportType } from '../models/report/report.model';

describe('ReportService', () => {
  let mockService: ReportService;
  beforeEach(() => {
    mockService = new ReportService();
  });
  describe('getReportType()', () => {
    describe(' - with valid report types', () => {
      it('should return ReportType.trailing30 when trailing30 is passed in with any case', () => {
        expect(mockService.getReportType('trailing30')).toBe(ReportType.Trailing30);
        expect(mockService.getReportType('Trailing30')).toBe(ReportType.Trailing30);
        expect(mockService.getReportType('TRAILING30')).toBe(ReportType.Trailing30);
      });
      it('should return ReportType.Week when week is passed in with any case', () => {
        expect(mockService.getReportType('week')).toBe(ReportType.Week);
        expect(mockService.getReportType('Week')).toBe(ReportType.Week);
        expect(mockService.getReportType('WEEK')).toBe(ReportType.Week);
      });
      it('should return ReportType.Month when month is passed in with any case', () => {
        expect(mockService.getReportType('month')).toBe(ReportType.Month);
        expect(mockService.getReportType('Month')).toBe(ReportType.Month);
        expect(mockService.getReportType('MONTH')).toBe(ReportType.Month);
      });
      it('should return ReportType.Year when year is passed in with any case', () => {
        expect(mockService.getReportType('year')).toBe(ReportType.Year);
        expect(mockService.getReportType('Year')).toBe(ReportType.Year);
        expect(mockService.getReportType('YEAR')).toBe(ReportType.Year);
      });
      it('should return ReportType.AllTime when all is passed in with any case', () => {
        expect(mockService.getReportType('all')).toBe(ReportType.AllTime);
        expect(mockService.getReportType('All')).toBe(ReportType.AllTime);
        expect(mockService.getReportType('ALL')).toBe(ReportType.AllTime);
      });
    });

    describe('- with invalid report type', () => {
      it('should return ReportType.AllTime when an invalid report type is passed in', () => {
        expect(mockService.getReportType('whatever')).toBe(ReportType.AllTime);
      });
    });
  });

  describe('isValidReportType()', () => {
    it('should return true when Trailing30 is passed in with any case', () => {
      expect(mockService.isValidReportType('trailing30')).toBe(true);
      expect(mockService.isValidReportType('Trailing30')).toBe(true);
      expect(mockService.isValidReportType('TRAILING30')).toBe(true);
    });
    it('should return true when week is passed in with any case', () => {
      expect(mockService.isValidReportType('week')).toBe(true);
      expect(mockService.isValidReportType('Week')).toBe(true);
      expect(mockService.isValidReportType('WEEK')).toBe(true);
    });
    it('should return true when month is passed in with any case', () => {
      expect(mockService.isValidReportType('month')).toBe(true);
      expect(mockService.isValidReportType('Month')).toBe(true);
      expect(mockService.isValidReportType('MONTH')).toBe(true);
    });
    it('should return true when year is passed in with any case', () => {
      expect(mockService.isValidReportType('year')).toBe(true);
      expect(mockService.isValidReportType('Year')).toBe(true);
      expect(mockService.isValidReportType('YEAR')).toBe(true);
    });
    it('should return true when all is passed in with any case', () => {
      expect(mockService.isValidReportType('all')).toBe(true);
      expect(mockService.isValidReportType('All')).toBe(true);
      expect(mockService.isValidReportType('ALL')).toBe(true);
    });
    it('should return false when a non-valid reportType is passed in', () => {
      expect(mockService.isValidReportType('whatever')).toBe(false);
    });
    it('should return false for a sentence', () => {
      expect(mockService.isValidReportType('test sentence that should fail day')).toBe(false);
    });
  });
});
