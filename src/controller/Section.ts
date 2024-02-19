/**
 * Represents each section from the data
 *
 */
export default class Section {
	public readonly uuid: string;
	public readonly id: string;
	public readonly title: string;
	public readonly instructor: string;
	public readonly dept: string;
	public readonly year: number;
	public readonly avg: number;
	public readonly pass: number;
	public readonly fail: number;
	public readonly audit: number;

	constructor(uuid: string, id: string, title: string, instructor: string, dept: string, year: number, avg: number,
		pass: number, fail: number, audit: number) {
		this.uuid = uuid;
		this.id = id;
		this.title = title;
		this.instructor = instructor;
		this.dept = dept;
		this.year = year;
		this.avg = avg;
		this.pass = pass;
		this.fail = fail;
		this.audit = audit;
	}

	// getters for QueryEngine

}
