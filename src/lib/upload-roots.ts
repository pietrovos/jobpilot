import path from "path";

// Uploads live under the process working directory; see docs/deployment.md.
export const applicationUploadsRoot = path.join(process.cwd(), "uploads", "application-files");
export const documentUploadsRoot = path.join(process.cwd(), "uploads", "documents");
export const profileUploadsRoot = path.join(process.cwd(), "uploads", "profile-pictures");
export const companyLogoUploadsRoot = path.join(process.cwd(), "uploads", "company-logos");
