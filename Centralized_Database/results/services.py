from .models import Result


def store_result(student, data):
    result, created = Result.objects.update_or_create(
        student=student,
        question_id=data['question_id'],
        defaults={
            'roll_number': data['roll_number'],
            'status': data['status'],
            'score': data['score'],
            'passed_testcases': data.get('passed_testcases', 0),
            'total_testcases': data.get('total_testcases', 0),
            'execution_time': data.get('execution_time', 0),
        }
    )
    return result

