/**
 * ====================================================================
 *  JIRA: SVC-1852 — Fix N+1 Query in Report Generation
 * ====================================================================
 *  P1 | Points: 2 | Labels: database, javascript, performance
 *
 *  Report generation takes 45 seconds for 100 records because each
 *  record triggers a separate DB query for related data (N+1 problem).
 *
 *  PRODUCTION LOG:
 *  [SLOW] generateReport: 45,230ms (100 records, 101 queries)
 *  [WARN] Connection pool exhausted during report generation
 *
 *  ACCEPTANCE CRITERIA:
 *  - [ ] Use JOIN or batch query instead of loop
 *  - [ ] Report generation completes in <2 seconds for 100 records
 *  - [ ] Single query (or constant number of queries) regardless of N
 * ====================================================================
 */

class ReportGenerator {
    constructor(db) {
        this.db = db;
    }

    async generateReport(departmentId) {
        // Query 1: Get all employees
        const employees = await this.db.query(
            `SELECT * FROM employees WHERE department_id = ${departmentId}`
            // BUG: Also a SQL injection risk — should use parameterized query
        );

        const report = [];
        for (const emp of employees) {
            // BUG: N+1 Query — this runs once per employee
            // Should be a single JOIN query or batch fetch
            const tasks = await this.db.query(
                `SELECT * FROM tasks WHERE assigned_to = ${emp.id}`
            );

            const reviews = await this.db.query(
                `SELECT * FROM performance_reviews WHERE employee_id = ${emp.id}`
            );

            report.push({
                employee: emp,
                taskCount: tasks.length,
                averageRating: this.calculateAverage(reviews),
            });
        }

        return report;
    }

    calculateAverage(reviews) {
        if (reviews.length === 0) return 0;
        // BUG: Integer division — should return float
        const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
        return Math.floor(sum / reviews.length);  // BUG: floor truncates
    }
}

module.exports = { ReportGenerator };
