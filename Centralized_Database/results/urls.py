from django.urls import path

from .views import (
    push_result,
    get_results
)

urlpatterns = [

    path('push_result/',push_result),
    path('result/',get_results),
]