import { getOwnedDocumentResponse } from "@/lib/application-files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  return getOwnedDocumentResponse(documentId, "inline", _request.headers.get("range"));
}
