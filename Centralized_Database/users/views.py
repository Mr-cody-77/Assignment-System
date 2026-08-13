from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    LoginSerializer,
    AddStudentSerializer,
    AddTeacherSerializer,
)

from .permissions import IsTeacher
from .services import create_student, create_teacher

from django.http import JsonResponse
import json
from rest_framework_simplejwt.exceptions import TokenError

@api_view(['POST'])
def login_view(request):
    serializer = LoginSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    username = serializer.validated_data['username']
    password = serializer.validated_data['password']


    user = authenticate(
        username=username,
        password=password,
    )

    if not user:
        return Response({
            'authenticated': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)

    return Response({
        'authenticated': True,
        'role': user.role,
        'username': user.username,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })

@api_view(['POST'])
def refresh_view(request):

    try:
        body = json.loads(request.body)

        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return JsonResponse(
                {"detail": "Refresh token required"},
                status=400
            )

        token = RefreshToken(refresh_token)

        return JsonResponse({
            "access": str(token.access_token)
        })

    except TokenError:
        return JsonResponse(
            {"detail": "Invalid refresh token"},
            status=401
        )

    except Exception as e:
        return JsonResponse(
            {"detail": str(e)},
            status=400
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher])
def add_teacher(request):

    serializer = AddTeacherSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=400
        )

    teacher = create_teacher(
        serializer.validated_data["username"],
        serializer.validated_data["password"]
    )

    if teacher is None:
        return Response({
            "success": False,
            "message": "Teacher already exists"
        })

    return Response({
        "success": True,
        "username": teacher.username,
        "role": teacher.role
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher])
def add_student(request):

    serializer = AddStudentSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=400
        )

    student = create_student(
        serializer.validated_data["roll_number"]
    )

    if student is None:
        return Response({
            "success": False,
            "message": "Student already exists"
        })

    return Response({
        "success": True,
        "username": student.username,
        "password": student.username
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_email(request):
    email = request.data.get('email')
    if not email:
        return Response({"detail": "Email is required"}, status=400)
    
    user = request.user
    user.email = email
    user.save()
    
    return Response({"success": True, "email": user.email})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    
    if not old_password or not new_password:
        return Response({"detail": "old_password and new_password are required"}, status=400)
        
    user = request.user
    if not user.check_password(old_password):
        return Response({"detail": "Incorrect old password"}, status=400)
        
    user.set_password(new_password)
    user.save()
    
    return Response({"success": True, "message": "Password updated successfully"})


# ═══════════════════════════════════════════════════════════════════════════════
# BULK UPLOAD STUDENTS — File Ingestion with Security Validation
# ═══════════════════════════════════════════════════════════════════════════════

# Security constants
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_ROWS = 5000
ALLOWED_EXTENSIONS = {'.xlsx', '.xls', '.csv'}

# Magic bytes for file type validation
FILE_SIGNATURES = {
    '.xlsx': [b'PK\x03\x04'],       # ZIP-based (OOXML)
    '.xls': [b'\xd0\xcf\x11\xe0'],  # OLE2 Compound Binary
    '.csv': None,                     # Text-based, no magic bytes
}

FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def _validate_file_security(uploaded_file):
    """Validate uploaded file for security threats. Returns (is_safe, error_message)."""
    # 1. Check file size
    if uploaded_file.size > MAX_FILE_SIZE:
        return False, f'File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB.'

    # 2. Check extension
    filename = uploaded_file.name or ''
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f'Invalid file type "{ext}". Allowed: {", ".join(ALLOWED_EXTENSIONS)}.'

    # 3. Magic byte verification
    file_header = uploaded_file.read(8)
    uploaded_file.seek(0)

    if ext in ('.xlsx', '.xls'):
        expected_sigs = FILE_SIGNATURES.get(ext, [])
        if expected_sigs:
            matched = any(file_header.startswith(sig) for sig in expected_sigs)
            if not matched:
                return False, 'File content does not match its extension. Possible tampering detected.'

    # 4. For .xlsx files, check for macros (VBA)
    if ext == '.xlsx':
        import zipfile
        import io
        try:
            uploaded_file.seek(0)
            with zipfile.ZipFile(io.BytesIO(uploaded_file.read()), 'r') as zf:
                zip_names = [n.lower() for n in zf.namelist()]
                dangerous_entries = ['xl/vbaproject.bin', 'xl/macrosheets/', 'xl/activex/']
                for danger in dangerous_entries:
                    if any(danger in name for name in zip_names):
                        return False, 'File contains macros or active content. This is not allowed for security reasons.'
            uploaded_file.seek(0)
        except zipfile.BadZipFile:
            return False, 'Corrupted or invalid Excel file.'
        except Exception as e:
            return False, f'Error inspecting file: {str(e)}'

    return True, None


def _sanitize_cell(value):
    """Sanitize a cell value to prevent formula injection."""
    if value is None:
        return ''
    val = str(value).strip()
    if val and val[0] in FORMULA_PREFIXES:
        val = "'" + val  # Neutralize formula
    return val


def _parse_file(uploaded_file):
    """Parse the uploaded file and extract student records.
    Returns (records, error_message) where records is a list of dicts."""
    import os
    import io
    import csv
    
    filename = uploaded_file.name or ''
    ext = os.path.splitext(filename)[1].lower()

    records = []
    uploaded_file.seek(0)

    try:
        if ext in ('.xlsx', '.xls'):
            import openpyxl
            wb = openpyxl.load_workbook(
                io.BytesIO(uploaded_file.read()), read_only=True, data_only=True
            )
            ws = wb.active
            if ws is None:
                return None, 'Excel file has no active worksheet.'

            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                return None, 'File is empty.'

            # Find header row
            header = [str(cell).strip().lower() if cell else '' for cell in rows[0]]

            # Map column names (flexible matching)
            col_map = {}
            for i, h in enumerate(header):
                if h in ('name', 'student name', 'student_name', 'studentname'):
                    col_map['name'] = i
                elif h in ('roll', 'roll_number', 'rollnumber', 'roll number',
                           'roll no', 'roll_no', 'rollno'):
                    col_map['roll'] = i
                elif h in ('department', 'dept', 'dept.', 'department name', 'branch'):
                    col_map['department'] = i

            if 'roll' not in col_map:
                return None, 'Required column "roll" (or "roll_number") not found in the file header.'
            if 'name' not in col_map:
                return None, 'Required column "name" not found in the file header.'

            has_dept = 'department' in col_map

            for row_idx, row in enumerate(rows[1:], start=2):
                if row_idx - 1 > MAX_ROWS:
                    break

                name_val = _sanitize_cell(
                    row[col_map['name']] if col_map['name'] < len(row) else None
                )
                roll_val = _sanitize_cell(
                    row[col_map['roll']] if col_map['roll'] < len(row) else None
                )
                dept_val = _sanitize_cell(
                    row[col_map['department']] if has_dept and col_map['department'] < len(row) else None
                )

                if not roll_val:
                    continue  # Skip empty rows

                records.append({
                    'name': name_val,
                    'roll': roll_val,
                    'department': dept_val if dept_val else 'N/A',
                })

            wb.close()

        elif ext == '.csv':
            content = uploaded_file.read()
            # Try to decode
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                text = content.decode('latin-1')

            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                return None, 'CSV file has no headers.'

            # Normalize field names
            field_map = {}
            for f in reader.fieldnames:
                fl = f.strip().lower()
                if fl in ('name', 'student name', 'student_name', 'studentname'):
                    field_map['name'] = f
                elif fl in ('roll', 'roll_number', 'rollnumber', 'roll number',
                            'roll no', 'roll_no', 'rollno'):
                    field_map['roll'] = f
                elif fl in ('department', 'dept', 'dept.', 'department name', 'branch'):
                    field_map['department'] = f

            if 'roll' not in field_map:
                return None, 'Required column "roll" (or "roll_number") not found in the CSV header.'
            if 'name' not in field_map:
                return None, 'Required column "name" not found in the CSV header.'

            has_dept = 'department' in field_map

            for row_idx, row in enumerate(reader, start=2):
                if row_idx - 1 > MAX_ROWS:
                    break

                name_val = _sanitize_cell(row.get(field_map['name'], ''))
                roll_val = _sanitize_cell(row.get(field_map['roll'], ''))
                dept_val = _sanitize_cell(
                    row.get(field_map.get('department', ''), '')
                ) if has_dept else ''

                if not roll_val:
                    continue

                records.append({
                    'name': name_val,
                    'roll': roll_val,
                    'department': dept_val if dept_val else 'N/A',
                })
        else:
            return None, f'Unsupported file format: {ext}'

    except Exception as e:
        logger.exception(f'Error parsing uploaded file: {e}')
        return None, f'Error reading file: {str(e)}'

    if not records:
        return None, 'No valid student records found in the file.'

    if len(records) > MAX_ROWS:
        return None, f'Too many rows. Maximum allowed is {MAX_ROWS}.'

    return records, None


from rest_framework.parsers import MultiPartParser, FormParser
from .services import bulk_create_students

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTeacher])
@parser_classes([MultiPartParser, FormParser])
def bulk_upload_students(request):
    """Bulk upload students from an Excel/CSV file.

    Security validation pipeline:
    1. Extension whitelist (.xlsx, .xls, .csv)
    2. File size limit (5 MB)
    3. Magic byte verification
    4. Macro/VBA detection for Excel files
    5. Row limit (5000)
    6. Cell content sanitization (formula injection prevention)
    """
    file = request.FILES.get('file')
    if not file:
        return Response(
            {'error': 'No file provided.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Security validation
    is_safe, security_error = _validate_file_security(file)
    if not is_safe:
        logger.warning(f'File security validation failed: {security_error}')
        return Response(
            {'error': security_error},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Parse file
    records, parse_error = _parse_file(file)
    if parse_error:
        return Response(
            {'error': parse_error},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Bulk create students
    result = bulk_create_students(records)

    logger.info(
        f'Bulk upload completed: created={result["created"]}, '
        f'skipped={result["skipped"]}, errors={len(result["errors"])}'
    )

    return Response({
        'message': 'Bulk upload completed.',
        'created': result['created'],
        'skipped': result['skipped'],
        'errors': result['errors'],
        'total_processed': result['created'] + result['skipped'] + len(result['errors']),
    }, status=status.HTTP_200_OK)
