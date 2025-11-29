from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from datetime import datetime

from app.core.config import get_settings
from app.core.auth import get_current_user
from app.services.supabase_client import supabase

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload PDF - user just drops the file, no metadata needed

    What happens:
    1. Verify auth (get_current_user returns dict)
    2. Validate file (PDF, < 50MB)
    3. Check upload limit
    4. Upload to Supabase Storage
    5. Create database record
    6. Return success
    """

    # Validate file type
    if not file.content_type == "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    # Read and validate size
    file_content = await file.read()
    file_size = len(file_content)

    # Check file size limit based on user tier
    max_file_size = (
        settings.max_file_size_premium
        if current_user["role"] in ["admin", "premium"]
        else settings.max_file_size_free
    )

    if file_size > max_file_size:
        max_mb = max_file_size / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size must be under {max_mb:.0f}MB for {current_user['role']} tier"
        )

    # Check upload limit (free users = 1/month)
    if current_user["role"] == "free":
        if current_user["uploads_this_month"] >= settings.free_upload_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Upload limit reached ({settings.free_upload_limit}/month for free tier)"
            )

    # Check total storage quota
    if current_user["role"] != "admin":
        storage_query = supabase.table("documents").select("file_size").eq(
            "clerk_id", current_user["clerk_id"]
        ).execute()

        total_storage_used = sum(doc["file_size"] for doc in storage_query.data)
        max_storage = (
            settings.max_storage_premium
            if current_user["role"] == "premium"
            else settings.max_storage_free
        )

        if total_storage_used + file_size > max_storage:
            max_storage_mb = max_storage / (1024 * 1024)
            used_mb = total_storage_used / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Storage quota exceeded. Used {used_mb:.1f}MB of {max_storage_mb:.0f}MB"
            )

    # Upload to Supabase Storage
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    storage_path = f"{current_user['clerk_id']}/{timestamp}_{file.filename}"

    try:
        # Upload file to 'documents' bucket (plural - matches Supabase bucket name)
        storage_response = supabase.storage.from_("documents").upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": "application/pdf"}
        )

        # Get public URL
        file_url = supabase.storage.from_("documents").get_public_url(storage_path)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )

    # Create document record (will be processed on first query - lazy processing)
    document_data = {
        "clerk_id": current_user["clerk_id"],
        "file_name": file.filename,
        "file_size": file_size,
        "file_url": file_url,
        "status": "pending",
        # company_name, document_type, document_year will be filled when processed
    }

    try:
        db_response = supabase.table("documents").insert(document_data).execute()
        created_document = db_response.data[0]
    except Exception as e:
        # Rollback: delete uploaded file if database insert fails
        supabase.storage.from_("documents").remove([storage_path])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create document record: {str(e)}"
        )

    # Update user upload count
    try:
        supabase.table("users").update({
            "uploads_this_month": current_user["uploads_this_month"] + 1
        }).eq("id", current_user["id"]).execute()
    except Exception:
        pass  # Don't fail upload if count update fails

    # TODO: Trigger Celery task to extract metadata
    # from app.tasks import process_document
    # process_document.delay(created_document["id"])

    # Return response
    return {
        "success": True,
        "message": "Document uploaded successfully",
        "document": {
            "id": created_document["id"],
            "fileName": file.filename,
            "fileSize": f"{file_size / (1024 * 1024):.2f} MB",
            "status": "pending",
            "uploadedAt": created_document["created_at"]
        }
    }


@router.get("/")
async def get_documents(current_user: dict = Depends(get_current_user)):
    """
    Get all documents for the current user

    Returns documents formatted for frontend compatibility
    """
    response = supabase.table("documents").select("*").eq(
        "clerk_id", current_user["clerk_id"]
    ).order("created_at", desc=True).execute()

    # Transform database format to frontend format
    documents = []
    for doc in response.data:
        documents.append({
            "id": doc["id"],
            "company": doc["company_name"] or "Unknown",
            "type": doc["document_type"] or "Unknown",
            "year": str(doc["document_year"]) if doc["document_year"] else "Unknown",
            "uploadedAt": doc["created_at"],  # Frontend can format this
            "status": doc["status"],
            "fileName": doc["file_name"],
            "fileSize": f"{doc['file_size'] / (1024 * 1024):.2f} MB"
        })

    return {
        "documents": documents
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a document (Premium/Admin only)

    Steps:
    1. Check if user has permission (premium or admin only)
    2. Verify document ownership
    3. Delete from Supabase Storage
    4. Delete from database (CASCADE will handle chunks when implemented)
    5. Update user upload count
    """

    # Get document first to check status
    doc_response = supabase.table("documents").select("*").eq("id", document_id).execute()

    if not doc_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    document = doc_response.data[0]

    # Verify ownership first
    if document["clerk_id"] != current_user["clerk_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this document"
        )

    # Check if user can delete based on role and document status
    if current_user["role"] == "free":
        # Free users can only delete unprocessed documents
        if document["status"] == "processed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete processed documents on free tier. Upgrade to Premium to manage your library."
            )
        # If status is "processing" or "failed", allow deletion

    # Extract storage path from file_url
    # file_url format: https://<supabase-project>.supabase.co/storage/v1/object/public/documents/<path>
    file_url = document["file_url"]
    storage_path = file_url.split("/documents/")[-1] if "/documents/" in file_url else None

    # Delete from Supabase Storage
    if storage_path:
        try:
            supabase.storage.from_("documents").remove([storage_path])
        except Exception as e:
            # Log error but continue - file might already be deleted
            print(f"Storage deletion error: {e}")

    # Delete from database
    # Note: When chunks table is implemented with ON DELETE CASCADE,
    # this will automatically delete all embeddings
    try:
        supabase.table("documents").delete().eq("id", document_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )

    # Update user upload count (decrement)
    try:
        if current_user["uploads_this_month"] > 0:
            supabase.table("users").update({
                "uploads_this_month": current_user["uploads_this_month"] - 1
            }).eq("id", current_user["id"]).execute()
    except Exception:
        pass  # Don't fail deletion if count update fails

    return {
        "success": True,
        "message": "Document deleted successfully",
        "document_id": document_id
    }
