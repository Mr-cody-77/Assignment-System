from django.contrib.auth.hashers import make_password
from .models import User


def create_teacher(username: str, password: str):
    username = username.lower()

    if User.objects.filter(username=username).exists():
        return None

    teacher = User.objects.create(
        username=username,
        password=make_password(password),
        role='teacher'
    )

    return teacher


def create_student(roll_number: str, name: str = '', department: str = 'N/A'):
    roll_number = roll_number.upper()

    if User.objects.filter(username=roll_number).exists():
        return None

    student = User.objects.create(
        username=roll_number,
        roll_number=roll_number,
        name=name,
        department=department,
        password=make_password(roll_number),
        role='student'
    )

    return student


def bulk_create_students(records: list):
    """
    records: list of dicts with 'name', 'roll', 'department'
    """
    rolls = [r['roll'].upper() for r in records if r.get('roll')]
    existing_users = set(User.objects.filter(username__in=rolls).values_list('username', flat=True))

    new_users = []
    skipped = 0
    errors = []

    for r in records:
        roll = r.get('roll', '').upper()
        if not roll:
            continue
            
        if roll in existing_users:
            skipped += 1
            continue

        try:
            user = User(
                username=roll,
                roll_number=roll,
                name=r.get('name', ''),
                department=r.get('department', 'N/A'),
                password=make_password(roll),
                role='student'
            )
            new_users.append(user)
            existing_users.add(roll)  # prevent duplicates within the same file
        except Exception as e:
            errors.append({'roll': roll, 'reason': str(e)})

    if new_users:
        User.objects.bulk_create(new_users, batch_size=500)

    return {
        'created': len(new_users),
        'skipped': skipped,
        'errors': errors
    }