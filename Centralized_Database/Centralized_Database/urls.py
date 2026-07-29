from django.contrib import admin
from django.urls import path, include

import os

urlpatterns = [
    path(os.getenv('ADMIN_URL', 'secret-admin/'), admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/results/', include('results.urls')),
    path('api/', include('questions.urls')), # This now serves /api/tests/ and /api/questions/
]