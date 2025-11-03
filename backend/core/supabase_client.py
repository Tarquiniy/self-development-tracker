import os
from supabase import create_client, Client

class SupabaseClient:
    _instance = None

    @classmethod
    def get_client(cls) -> Client:
        if cls._instance is None:
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_KEY')

            if not supabase_url or not supabase_key:
                raise ValueError("Supabase URL and Key must be set in environment variables")

            cls._instance = create_client(supabase_url, supabase_key)

        return cls._instance

# Утилита для работы с Supabase
def get_supabase():
    return SupabaseClient.get_client()