import InsightFacade from "../../src/controller/InsightFacade";
import {clearDisk, getContentFromArchives, ITestQuery, readFileQueries} from "../resources/archives/TestUtil";
import {
	InsightDatasetKind,
	InsightError,
	NotFoundError,
	ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import chai, {assert, expect} from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

describe("Test InsightFacade", () => {

	describe("Test addDataset and listDataset", () => {
		let directory: string;
		let sections: string;
		let facade: InsightFacade;

		before(async function () {
			sections = await getContentFromArchives("valid_dataset_one.zip");
			// directory = "test/resources/archives/";
			// sections = directory + "StartsWithBCDE.zip";
		});

		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});


		it("should reject empty dataset id", function () {
			const result = facade.addDataset("", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should pass when added first then failed when added twice", async function () {
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			let result = facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when only whitespace id", function () {
			const result = facade.addDataset("  ", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when id contains underscore", function () {
			const result = facade.addDataset("ub_c", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should pass when id contains whitespace and others", function () {
			const result = facade.addDataset("ubc is great", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.members(["ubc is great"]);
		});

		it("should return added so far", async function () {
			let result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections)
				.then((r) => facade.addDataset("ubc 1", sections, InsightDatasetKind.Sections))
				.then((k) => facade.addDataset("ubc 2", sections, InsightDatasetKind.Sections));

			return expect(result).to.have.members(["ubc", "ubc 1", "ubc 2"]);
		});

		it("data should persist when new instance created", async function () {
			let result = await facade.addDataset("ubc", sections, InsightDatasetKind.Sections)
				.then(() => facade.addDataset("ubc-2", sections, InsightDatasetKind.Sections));

			return expect(result).to.have.members(["ubc", "ubc-2"]);
		});

		it("should reject when no content", async function () {
			sections = await getContentFromArchives("invalid_no_data.zip");
			const result = facade.addDataset("none", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should pass when valid content (one course)", async function () {
			sections = await getContentFromArchives("valid_dataset_one.zip");
			const result = facade.addDataset("one", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.members(["one"]);
		});

		it("should list one dataset", async function () {
			sections = await getContentFromArchives("pair.zip");
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
			const result = facade.listDatasets();

			return expect(result).to.eventually.deep.equal([{
				id: "ubc",
				kind: InsightDatasetKind.Sections,
				numRows: 64612
			}]);
		});

		// list multiple datasets?
		it("should list multiple dataset", async function () {
			sections = await getContentFromArchives("pair.zip");
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);

			sections = await getContentFromArchives("valid_dataset_one.zip");
			await facade.addDataset("plz work", sections, InsightDatasetKind.Sections);

			const result = facade.listDatasets();

			return expect(result).to.eventually.deep.equal([
				{
					id: "ubc",
					kind: InsightDatasetKind.Sections,
					numRows: 64612
				}, {
					id: "plz work",
					kind: InsightDatasetKind.Sections,
					numRows: 2
				}]);
		});

		it("should list an empty dataset when no dataset added", async function () {
			const result = facade.listDatasets();

			return expect(result).to.eventually.deep.equal([]);
		});


		it("should pass when valid content (more courses)", async function () {
			sections = await getContentFromArchives("valid_dataset_more.zip");
			const result = facade.addDataset("more", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.have.members(["more"]);
		});

		it("should reject when no courses folder in zip", async function () {
			sections = await getContentFromArchives("invalid_no_courses_folder.zip");
			const result = facade.addDataset("no courses folder", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when no valid sec", async function () {
			sections = await getContentFromArchives("invalid_no_section.zip");
			const result = facade.addDataset("no valid section", sections, InsightDatasetKind.Sections);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when Room Kind", function () {
			const result = facade.addDataset("room", sections, InsightDatasetKind.Rooms);

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

	});

	describe("Test removeDataset", () => {
		let sections: string;
		let facade: InsightFacade;

		before(async function () {
			sections = await getContentFromArchives("StartsWithBCDE.zip");
		});

		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
			await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
		});

		it("should reject when removing empty id", function () {
			const result = facade.removeDataset("");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when removing only white space id", function () {
			const result = facade.removeDataset("  ");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject when removing id contains underscore", function () {
			const result = facade.removeDataset("ub_c");

			return expect(result).to.eventually.be.rejectedWith(InsightError);
		});

		it("should pass when removing valid (ubc)", function () {
			const result = facade.removeDataset("ubc");

			return expect(result).to.eventually.equal("ubc");
		});

		it("should pass when removing valid whitespace (ubc one)", async function () {
			await facade.addDataset("ubc one", sections, InsightDatasetKind.Sections);
			const result = facade.removeDataset("ubc one");

			return expect(result).to.eventually.equal("ubc one");
		});

		it("remove should actually remove", function () {
			const result = facade.removeDataset("ubc")
				.then(() => facade.addDataset("new", sections, InsightDatasetKind.Sections));

			return expect(result).to.eventually.have.members(["new"]);
		});

		it("should reject when removing twice", function () {
			const result = facade.removeDataset("ubc")
				.then(() => facade.removeDataset("ubc"));

			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});

		it("should reject when removing non-exist", function () {
			const result = facade.removeDataset("not there");

			return expect(result).to.eventually.be.rejectedWith(NotFoundError);
		});
	});

	describe("Test Query and EBNF", () => {
		let facade: InsightFacade;
		let sections: string;
		let ubc: string;

		before(async function () {
			await clearDisk();
			sections = await getContentFromArchives("pair.zip");
			ubc = await getContentFromArchives("valid_dataset_one.zip");
			facade = new InsightFacade();
			await facade.addDataset("sections", sections, InsightDatasetKind.Sections);
			await facade.addDataset("ubc", ubc, InsightDatasetKind.Sections);
		});

		describe("non object queries", function () {
			it("non object input", function () {
				const result = facade.performQuery(null);

				return expect(result).to.eventually.be.rejectedWith(InsightError);
			});
		});

		describe("valid queries", function () {

			let validQueries: ITestQuery[];

			try {

				validQueries = readFileQueries("valid");

			} catch (e: unknown) {

				expect.fail(`Failed to read one or more test queries. ${e}`);

			}


			validQueries.forEach(function (test: any) {

				it(`${test.title}`, function () {
					return facade.performQuery(test.input).then((result) => {
						expect(result).to.deep.equal(test.expected);
					}).catch((err: string) => {
						assert.fail(`performQuery threw unexpected error: ${err}`);
					});

				});

			});

		});


		describe("invalid insight error queries", function () {
			let validQueries: ITestQuery[];

			try {

				validQueries = readFileQueries("invalid_insight");

			} catch (e: unknown) {

				expect.fail(`Failed to read one or more test queries. ${e}`);

			}


			validQueries.forEach(function (test: any) {

				it(`${test.title}`, function () {
					const result = facade.performQuery(test.input);

					return expect(result).to.eventually.be.rejectedWith(InsightError);
				});

			});
		});


		describe("invalid too large error query", function () {
			let validQueries: ITestQuery[];

			try {

				validQueries = readFileQueries("invalid_toolarge");

			} catch (e: unknown) {

				expect.fail(`Failed to read one or more test queries. ${e}`);

			}


			validQueries.forEach(function (test: any) {

				it(`${test.title}`, function () {
					const result = facade.performQuery(test.input);

					return expect(result).to.eventually.be.rejectedWith(ResultTooLargeError);
				});

			});
		});


	});
});
