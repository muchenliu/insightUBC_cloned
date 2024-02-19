import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError} from "./IInsightFacade";
import JSZip from "jszip";
import * as fs from "fs-extra";
import Section from "./Section";
import PerformQueryHelper from "./PerformQueryHelper";
import PrefixHelper from "./PrefixHelper";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private dir = "data";

	constructor() {
		console.log("InsightFacadeImpl::init()");
	}


	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		this.checkIDInput(id);

		// check kind
		if (kind !== InsightDatasetKind.Sections) {
			throw new InsightError("Error. DatasetKind should be Section");
		}

		// read ./data to grab names of the datasets which are already on disk
		let alreadyOnDisk: string[];
		let zip: JSZip = new JSZip();
		return this.returnAlreadyOnDisk(this.dir).then(function(onDisk) {
			// console.log(onDisk);
			if (onDisk.includes(id)) {
				// console.log("Duplicate Dataset");
				throw new InsightError("Error. Duplicate Dataset");
			}
			alreadyOnDisk = onDisk;
		}).then(function() {
			// parsing
			return zip.loadAsync(content, {base64: true});
		}).then(function (zipLoad) {
			// check for root folder "courses"
			if (zip.folder(/^courses/).length < 1) {
				// console.log("root folder err");
				throw new InsightError("Error. Cannot find course root folder");
			}
			return zipLoad;
		}).then(function (zipLoad) {
			let allCourses = zipLoad.folder("courses");
			// console.log(allCourses);
			return allCourses;
		}).then(function (allCourses) {
			if (allCourses !== null) {
				let iFacade: InsightFacade = new InsightFacade();
				return iFacade.returnValidSections(allCourses);
			}
		}).then(function (validSections) {
			if (validSections === undefined || validSections.length === 0) {
				// console.log("no valid sec");
				throw new InsightError("Error. This dataset has no valid section");
			}
			// console.log(validSections);
			return validSections;
		}).then(function (data) {
			let iFacadeTwo: InsightFacade = new InsightFacade();
			return fs.writeJson(iFacadeTwo.dir + "/" + id + ".json", data);
		}).then(function () {
			// console.log("set added " + id);
			alreadyOnDisk.push(id);
			// console.log(alreadyOnDisk);
			return alreadyOnDisk;
		}).catch((err) => {
			throw new InsightError();
		});
	}

	private returnValidSections(allCourses: JSZip): Promise<Section[]> {
		let validSections: Section[] = [];
		// load each course in the folder
		const promises: any[] = [];
		allCourses.forEach(function (relativePath, file) {
			promises.push(file.async("text"));
		});
		return Promise.all(promises).then(function (data) {
			for (const item of data) {
				// Parse the JSON string into an object
				const course = JSON.parse(item);
				// Extract the "result" array from the object, the sections info
				const sections = course.result;
				// Loop through each section to see if it is a valid section
				for (const section of sections) {
					// Check if the section has all require fields
					if ("id" in section && "Course" in section && "Title" in section && "Professor" in section
						&& "Subject" in section && "Year" in section && "Avg" in section && "Pass" in section &&
						"Fail" in section && "Audit" in section) {

						if (section.Section === "overall") {
							section.Year = "1900";
						}

						let currentSec: Section = new Section(section.id, section.Course, section.Title,
							section.Professor, section.Subject, section.Year, section.Avg, section.Pass,
							section.Fail, section.Audit);
						validSections.push(currentSec);
					}
				}
			}

			return validSections;
		}).catch(function (err) {
			throw new InsightError("Error. Something went wrong when reading file");
		});
	}

	private checkIDInput(id: string) {
		// check id
		// check if id is null
		if (id == null) {
			throw new InsightError("Error. Given NULL id");
		}

		// check if id is whitespace
		if (/^\s*$/.test(id)) {
			throw new InsightError("Error. Given only whitespace id");
		}

		// check if id contains underscores
		if (id.includes("_")) {
			throw new InsightError("Error. Id includes an underscore");
		}
	}

	private async returnAlreadyOnDisk(dir: string): Promise<string[]> {
		let rtv: string[] = [];
		await fs.ensureDir(dir)
			.then(function() {
				return fs.readdir(dir);
			}).then(function(files) {
				files.forEach(function (file) {
					// console.log(file + " HERE");
					const fileID = file.split(".")[0];
					// console.log(fileID);
					rtv.push(fileID);
				});
				return rtv;
			}).then(function(rt) {
				return rt;
			}).catch((err) => console.error("Error. Something went wrong when reading dir ./data"));

		return rtv;
	}

	public async removeDataset(id: string): Promise<string> {

		this.checkIDInput(id);

		try {
			let path = require("path");

			await fs.unlink(path.join("./data", `${id}.json`));

			return id;

		} catch (error) {
			throw new NotFoundError("File not found");
		}
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// check if query is null
		if (query === null) {
			console.log("Non Object query");
			throw new InsightError("Error: nonObject query");
		}

		// parses given json file
		const JSON_PARSED = JSON.parse(JSON.stringify(query));

		// checks if json file has option WHERE
		if (!("WHERE" in JSON_PARSED)) {
			console.log("No WHERE error");
			throw new InsightError("Error: No WHERE block");
		}

		// checks if json file has option OPTIONS
		if (!("OPTIONS" in JSON_PARSED)) {
			console.log("No OPTIONS error");
			throw new InsightError("Error: No OPTIONS block");
		}

		let helper: PerformQueryHelper = new PerformQueryHelper(this.dir);
		let pHelper: PrefixHelper = new PrefixHelper();
		let optionFileName: string;

		return await pHelper.options_prefix(JSON_PARSED, true).then(function(OPTION_FILE_NAME) {
			console.log("OPTION_FILE_NAME " + OPTION_FILE_NAME);

			// if prefix does not exist throw insighterror
			if (OPTION_FILE_NAME == null) {
				throw new InsightError("Error: No prefix in option block");
			}
			optionFileName = OPTION_FILE_NAME;
		}).then(function() {
			return pHelper.where_prefix(JSON_PARSED);
		}).then(function(WHERE_FILE_NAME) {
			console.log("WHERE_FILE_NAME " + WHERE_FILE_NAME);

			if (!(optionFileName === WHERE_FILE_NAME)) {
				throw new InsightError("Error: query references different datasets");
			}
		}).then(function() {
			// check if json file exists in data folder
			let path = require("path");

			const EXISITING_FILES = path.join("./data", `${optionFileName}.json`);

			// console.log(EXISITING_FILES);

			// checks to see if file exists in data
			if (!fs.existsSync(EXISITING_FILES)) {
				// console.log("asdjfasdfdsaf");
				throw new InsightError("Error: Dataset has not been added yet.");
			}
			return EXISITING_FILES;
		}).then(function(filePath) {
			return fs.readFile(filePath, "utf8");
		}).then(function(fileData) {
			let fitSections = helper.handleWhere(JSON_PARSED.WHERE, fileData, false);
			// console.log("==========");
			// console.log(fitSections);
			return helper.handleOption(JSON_PARSED.OPTIONS, fitSections);
		}).catch(function(error) {
			if (error instanceof ResultTooLargeError) {
				throw new ResultTooLargeError("Over 5000 items queried.");
			}
			console.log("query is invalid");
			throw new InsightError();
		});
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		try {
			// gets all json files in folder data
			const JSON_FILES = await fs.readdir("./data");

			// creates promise for each json file
			const PROMISES = JSON_FILES.map(async (JSON_FILE) => {
				let path = require("path");

				// read the JSON_FILE
				const JSON_FILE_DATA = await fs.readFile(path.join("./data", JSON_FILE), "utf-8");

				// parse to count num rows
				const JSON_PARSED = JSON.parse(JSON_FILE_DATA);

				// count number of rows
				const JSON_NUM_ROWS = JSON_PARSED.length;

				// assigns InsightDatset values
				const CURR_INSIGHT_DATASET: InsightDataset = {
					id: JSON_FILE.replace(/\.json$/, ""),
					kind: InsightDatasetKind.Sections,
					numRows: JSON_NUM_ROWS
				};

				return CURR_INSIGHT_DATASET;

			});

			// execute the promises on each file
			const LIST_DATA = await Promise.all(PROMISES);

			return LIST_DATA.reverse();

		} catch (error) {
			return [];
		}
	}
}

