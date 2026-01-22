// tasks.js - Manual Verification System

let currentVerificationTask = null;

// Open verification modal
function openVerificationModal(taskName) {
    currentVerificationTask = taskName;
    
    // Update modal title based on task
    const taskTitles = {
        'twitter': 'Twitter Follow Verification',
        'facebook': 'Facebook Like Verification',
        'instagram': 'Instagram Follow Verification',
        'youtube': 'YouTube Subscribe Verification',
        'telegram': 'Telegram Join Verification'
    };
    
    document.getElementById('modalTitle').textContent = 
        taskTitles[taskName] || 'Upload Verification Proof';
    
    // Show modal
    document.getElementById('verificationModal').style.display = 'block';
    document.body.classList.add('no-scroll');
    
    // Reset upload area
    resetUploadArea();
}

// Close modal
function closeModal() {
    document.getElementById('verificationModal').style.display = 'none';
    document.body.classList.remove('no-scroll');
    currentVerificationTask = null;
    resetUploadArea();
}

// Reset upload area
function resetUploadArea() {
    const previewContainer = document.getElementById('previewContainer');
    const dropArea = document.getElementById('dropArea');
    const submitBtn = document.getElementById('submitVerification');
    
    previewContainer.style.display = 'none';
    dropArea.querySelector('.upload-placeholder').style.display = 'block';
    submitBtn.disabled = true;
    
    // Reset file input
    const fileInput = document.getElementById('screenshotUpload');
    fileInput.value = '';
}

// Setup drag and drop
function setupDragAndDrop() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('screenshotUpload');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropArea.style.borderColor = '#ffb300';
        dropArea.style.background = 'rgba(255, 179, 0, 0.1)';
    }
    
    function unhighlight(e) {
        dropArea.style.borderColor = 'var(--accent-color)';
        dropArea.style.background = 'rgba(0, 0, 0, 0.2)';
    }
    
    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    // Handle click to upload
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', function(e) {
        handleFiles(this.files);
    });
}

// Handle uploaded files
function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!file.type.match('image.*')) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid File',
            text: 'Please upload an image file (JPG, PNG, GIF)'
        });
        return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
            icon: 'error',
            title: 'File Too Large',
            text: 'Maximum file size is 5MB'
        });
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewContainer = document.getElementById('previewContainer');
        const dropArea = document.getElementById('dropArea');
        const submitBtn = document.getElementById('submitVerification');
        
        document.getElementById('imagePreview').src = e.target.result;
        previewContainer.style.display = 'block';
        dropArea.querySelector('.upload-placeholder').style.display = 'none';
        submitBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// Remove uploaded image
function removeImage() {
    resetUploadArea();
}

// Submit verification
async function submitVerification() {
    if (!currentVerificationTask) {
        alert('No task selected');
        return;
    }
    
    const fileInput = document.getElementById('screenshotUpload');
    if (!fileInput.files[0]) {
        Swal.fire({
            icon: 'error',
            title: 'No File Selected',
            text: 'Please upload a screenshot first'
        });
        return;
    }
    
    try {
        // Show loading
        Swal.fire({
            title: 'Submitting Verification...',
            text: 'Please wait while we upload your proof',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Create FormData
        const formData = new FormData();
        formData.append('screenshot', fileInput.files[0]);
        formData.append('task', currentVerificationTask);
        formData.append('userAddress', userAddress);
        formData.append('timestamp', Date.now());
        
        // Send to backend
        const response = await fetch('/api/submit-verification', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Verification Submitted!',
                html: `
                    <p>Your ${currentVerificationTask} verification has been submitted.</p>
                    <p><strong>Verification ID:</strong> ${result.verificationId}</p>
                    <p>Our team will review it within 24 hours.</p>
                `,
                confirmButtonText: 'OK'
            });
            
            // Update task status
            updateTaskStatus(currentVerificationTask, 'pending');
            
            // Close modal
            closeModal();
            
        } else {
            throw new Error(result.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Verification submission error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Submission Failed',
            text: error.message || 'Please try again later'
        });
    }
}

// Update task status on UI
function updateTaskStatus(task, status) {
    const statusElement = document.getElementById(`${task}Status`);
    if (statusElement) {
        statusElement.className = `status ${status}`;
        
        const statusText = {
            'pending': '⏳ Pending Verification',
            'verified': '✅ Verified',
            'rejected': '❌ Rejected - Please try again'
        };
        
        statusElement.textContent = statusText[status] || status;
        
        // If verified, disable verify button
        if (status === 'verified') {
            const buttons = document.querySelectorAll(`[onclick*="${task}"]`);
            buttons.forEach(btn => {
                btn.disabled = true;
                btn.textContent = 'Verified';
                btn.classList.add('verified');
            });
        }
    }
}

// Check verification status periodically
async function checkVerificationStatus() {
    if (!userAddress) return;
    
    try {
        const response = await fetch(`/api/verification-status/${userAddress}`);
        const statuses = await response.json();
        
        // Update each task status
        for (const [task, status] of Object.entries(statuses)) {
            updateTaskStatus(task, status);
        }
        
    } catch (error) {
        console.error('Error checking verification status:', error);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupDragAndDrop();
    
    // Check verification status every 30 seconds
    setInterval(checkVerificationStatus, 30000);
    
    // Also check when user connects wallet
    window.addEventListener('walletConnected', checkVerificationStatus);
});
