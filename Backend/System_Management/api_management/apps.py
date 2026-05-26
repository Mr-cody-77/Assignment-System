import os
from django.apps import AppConfig

class ApiManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api_management'

    def ready(self):
        # The RUN_MAIN check prevents Django's dev server from 
        # starting the discovery thread twice.
        if os.environ.get('RUN_MAIN') == 'true':
            from Services.Sender_Server.network import start_discovery
            
            # Start the Zeroconf broadcast loop!
            start_discovery()