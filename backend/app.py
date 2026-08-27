"""
Study Buddy Generator - Flask Backend
AI 學習夥伴應用程式主入口
"""

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent

# Always load the backend-local environment file, regardless of the process cwd.
load_dotenv(BACKEND_DIR / '.env')

def create_app():
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://localhost:5173"],
            "methods": ["GET", "POST", "DELETE"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
    app.config['UPLOAD_FOLDER'] = str(BACKEND_DIR / 'uploads')
    
    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from routes.documents import documents_bp
    from routes.study_tools import study_tools_bp
    
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(study_tools_bp, url_prefix='/api/study')
    
    @app.route('/api/health')
    def health_check():
        from config import get_database, is_database_configured

        if is_database_configured():
            try:
                get_database().ping()
            except Exception:
                app.logger.exception("Database health check failed")
                return {
                    'status': 'unhealthy',
                    'message': 'Study Buddy API cannot reach its database',
                    'database': 'unavailable',
                }, 503
        return {
            'status': 'healthy',
            'message': 'Study Buddy API is running!',
            'database': 'connected' if is_database_configured() else 'memory',
        }
    
    return app

if __name__ == '__main__':
    app = create_app()
    debug_enabled = os.getenv('FLASK_DEBUG', '').lower() in {'1', 'true', 'yes'}
    app.run(debug=debug_enabled, port=int(os.getenv('PORT', '5001')))
