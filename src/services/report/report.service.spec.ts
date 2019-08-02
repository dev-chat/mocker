import { ReportType } from "../../shared/models/muzzle/muzzle-models";
import { ReportService } from "./report.service";

describe("ReportService", () => {
  let mockService: ReportService;
  beforeEach(() => {
    mockService = new ReportService();
  });
  describe("getReportType()", () => {
    describe(" - with valid report types", () => {
      it("should return ReportType.Day when day is passed in with any case", () => {
        expect(mockService.getReportType("day")).toBe(ReportType.Day);
        expect(mockService.getReportType("Day")).toBe(ReportType.Day);
        expect(mockService.getReportType("DAY")).toBe(ReportType.Day);
      });
      it("should return ReportType.Week when week is passed in with any case", () => {
        expect(mockService.getReportType("week")).toBe(ReportType.Week);
        expect(mockService.getReportType("Week")).toBe(ReportType.Week);
        expect(mockService.getReportType("WEEK")).toBe(ReportType.Week);
      });
      it("should return ReportType.Month when month is passed in with any case", () => {
        expect(mockService.getReportType("month")).toBe(ReportType.Month);
        expect(mockService.getReportType("Month")).toBe(ReportType.Month);
        expect(mockService.getReportType("MONTH")).toBe(ReportType.Month);
      });
      it("should return ReportType.Year when year is passed in with any case", () => {
        expect(mockService.getReportType("year")).toBe(ReportType.Year);
        expect(mockService.getReportType("Year")).toBe(ReportType.Year);
        expect(mockService.getReportType("YEAR")).toBe(ReportType.Year);
      });
      it("should return ReportType.AllTime when all is passed in with any case", () => {
        expect(mockService.getReportType("all")).toBe(ReportType.AllTime);
        expect(mockService.getReportType("All")).toBe(ReportType.AllTime);
        expect(mockService.getReportType("ALL")).toBe(ReportType.AllTime);
      });
    });

    describe("- with invalid report type", () => {
      it("should return ReportType.AllTime when an invalid report type is passed in", () => {
        expect(mockService.getReportType("whatever")).toBe(ReportType.AllTime);
      });
    });
  });

  describe("isValidReportType()", () => {
    it("should return true when day is passed in with any case", () => {
      expect(mockService.isValidReportType("day")).toBe(true);
      expect(mockService.isValidReportType("Day")).toBe(true);
      expect(mockService.isValidReportType("DAY")).toBe(true);
    });
    it("should return true when week is passed in with any case", () => {
      expect(mockService.isValidReportType("week")).toBe(true);
      expect(mockService.isValidReportType("Week")).toBe(true);
      expect(mockService.isValidReportType("WEEK")).toBe(true);
    });
    it("should return true when month is passed in with any case", () => {
      expect(mockService.isValidReportType("month")).toBe(true);
      expect(mockService.isValidReportType("Month")).toBe(true);
      expect(mockService.isValidReportType("MONTH")).toBe(true);
    });
    it("should return true when year is passed in with any case", () => {
      expect(mockService.isValidReportType("year")).toBe(true);
      expect(mockService.isValidReportType("Year")).toBe(true);
      expect(mockService.isValidReportType("YEAR")).toBe(true);
    });
    it("should return true when all is passed in with any case", () => {
      expect(mockService.isValidReportType("all")).toBe(true);
      expect(mockService.isValidReportType("All")).toBe(true);
      expect(mockService.isValidReportType("ALL")).toBe(true);
    });
    it("should return false when a non-valid reportType is passed in", () => {
      expect(mockService.isValidReportType("whatever")).toBe(false);
    });
    it("should return false for a sentence", () => {
      expect(
        mockService.isValidReportType("test sentence that should fail day")
      ).toBe(false);
    });
  });
});
