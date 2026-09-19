import { getOwnedFileResponse } from "@/lib/application-files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  return getOwnedFileResponse(fileId, "inline", _request.headers.get("range"));
}
