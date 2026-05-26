from django.contrib import admin

from .models import (
    Question,
    TestCase,
    HiddenTestCase
)

admin.site.register(Question)
admin.site.register(TestCase)
admin.site.register(HiddenTestCase)