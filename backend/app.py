"""
Study Buddy Generator - Flask Backend
AI 學習夥伴應用程式主入口
"""

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

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
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
    
    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from routes.documents import documents_bp
    from routes.study_tools import study_tools_bp
    
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(study_tools_bp, url_prefix='/api/study')
    
    @app.route('/api/health')
    def health_check():
        return {'status': 'healthy', 'message': 'Study Buddy API is running!'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
