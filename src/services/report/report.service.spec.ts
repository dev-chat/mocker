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
      expect(mockService.getReportType("whatever")).toBe(ReportType.AllTime);
    });
  });

  describe("isValidReportType()", () => {
    it("should return ReportType.Day when day is passed in with any case", () => {
      expect(mockService.isValidReportType("day")).toBe(ReportType.Day);
      expect(mockService.isValidReportType("Day")).toBe(ReportType.Day);
      expect(mockService.isValidReportType("DAY")).toBe(ReportType.Day);
    });
    it("should return ReportType.Week when week is passed in with any case", () => {
      expect(mockService.isValidReportType("week")).toBe(ReportType.Week);
      expect(mockService.isValidReportType("Week")).toBe(ReportType.Week);
      expect(mockService.isValidReportType("WEEK")).toBe(ReportType.Week);
    });
    it("should return ReportType.Month when month is passed in with any case", () => {
      expect(mockService.isValidReportType("month")).toBe(ReportType.Month);
      expect(mockService.isValidReportType("Month")).toBe(ReportType.Month);
      expect(mockService.isValidReportType("MONTH")).toBe(ReportType.Month);
    });
    it("should return ReportType.Year when year is passed in with any case", () => {
      expect(mockService.isValidReportType("year")).toBe(ReportType.Year);
      expect(mockService.isValidReportType("Year")).toBe(ReportType.Year);
      expect(mockService.isValidReportType("YEAR")).toBe(ReportType.Year);
    });
    it("should return ReportType.AllTime when all is passed in with any case", () => {
      expect(mockService.isValidReportType("all")).toBe(ReportType.AllTime);
      expect(mockService.isValidReportType("All")).toBe(ReportType.AllTime);
      expect(mockService.isValidReportType("ALL")).toBe(ReportType.AllTime);
    });
  });
});