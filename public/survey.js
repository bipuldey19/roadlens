document.addEventListener('DOMContentLoaded', function() {
    const uploadInput = document.getElementById('uploadInput');
    const captureInput = document.getElementById('captureInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('previewContainer');
    const clearButton = document.getElementById('clearButton');
    const coordinatesContainer = document.getElementById('coordinatesContainer');
    const coordinatesLoading = document.getElementById('coordinatesLoading');
    const coordinatesError = document.getElementById('coordinatesError');
    const coordinates = document.getElementById('coordinates');
    const form = document.getElementById('surveyForm');

    // Image Modal Elements
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');

    // Toast configuration
    const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener("mouseenter", Swal.stopTimer);
            toast.addEventListener("mouseleave", Swal.resumeTimer);
        },
    });

    // Add these constants at the top
    const LOCATION_TIMEOUT = 15000; // 15 seconds
    const LOCATION_MAX_RETRIES = 3;
    const LOCATION_OPTIONS = {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT,
        maximumAge: 0
    };

    // Add retry counter to formState
    const formState = {
        hasImage: false,
        hasLocation: false,
        isCapture: false,
        locationRetries: 0
    };

    function getCoordinates(isRetry = false) {
        if (!isRetry) {
            formState.locationRetries = 0;
        }

        if (formState.locationRetries >= LOCATION_MAX_RETRIES) {
            Toast.fire({
                icon: "warning",
                title: "Unable to get accurate location. Continue without location?",
                showConfirmButton: true,
                showCancelButton: true,
                confirmButtonText: 'Continue',
                cancelButtonText: 'Try Again',
                timer: null
            }).then((result) => {
                if (result.isConfirmed) {
                    // Allow form submission without location
                    formState.hasLocation = true;
                    formState.isCapture = false;
                    updateSubmitButton();
                } else if (result.isDismissed) {
                    // Reset retry count and try again
                    formState.locationRetries = 0;
                    getCoordinates(true);
                }
            });
            return;
        }

        coordinatesContainer.classList.remove('hidden');
        coordinatesLoading.classList.remove('hidden');
        coordinates.classList.add('hidden');
        coordinatesError.classList.add('hidden');

        if (!navigator.geolocation) {
            handleLocationError('Geolocation is not supported by your browser');
            return;
        }

        // Show loading state with retry count if retrying
        if (formState.locationRetries > 0) {
            document.getElementById('coordinatesLoading').innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    <span class="text-gray-700 font-medium">Getting location... (Attempt ${formState.locationRetries + 1}/${LOCATION_MAX_RETRIES})</span>
                </div>
            `;
        }

        navigator.geolocation.getCurrentPosition(
            function success(position) {
                document.getElementById('latitude').textContent = position.coords.latitude.toFixed(6);
                document.getElementById('longitude').textContent = position.coords.longitude.toFixed(6);
                document.getElementById('accuracy').textContent = position.coords.accuracy.toFixed(1) + 'm';

                coordinatesLoading.classList.add('hidden');
                coordinates.classList.remove('hidden');
                
                // Update form state
                formState.hasLocation = true;
                updateSubmitButton();

                // Show success message
                Toast.fire({
                    icon: "success",
                    title: "Location acquired successfully"
                });
            },
            function error(err) {
                console.error("Error getting location:", err);
                formState.locationRetries++;

                if (err.code === err.TIMEOUT) {
                    handleLocationError('Location request timed out. Retrying...', true);
                } else if (err.code === err.PERMISSION_DENIED) {
                    handleLocationError('Please enable location access in your browser settings');
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    handleLocationError('Location information is unavailable. Retrying...', true);
                } else {
                    handleLocationError('An unknown error occurred. Retrying...', true);
                }
            },
            LOCATION_OPTIONS
        );
    }

    function handleLocationError(message, canRetry = false) {
        coordinatesLoading.classList.add('hidden');
        coordinatesError.classList.remove('hidden');
        document.getElementById('cordErr').textContent = message;
        
        formState.hasLocation = false;
        updateSubmitButton();

        if (canRetry && formState.locationRetries < LOCATION_MAX_RETRIES) {
            setTimeout(() => getCoordinates(true), 1000); // Retry after 1 second
        } else if (!canRetry) {
            // Show error toast with option to try again
            Toast.fire({
                icon: "error",
                title: message,
                showConfirmButton: true,
                confirmButtonText: 'Try Again',
                timer: null
            }).then((result) => {
                if (result.isConfirmed) {
                    formState.locationRetries = 0;
                    getCoordinates(true);
                }
            });
        }
    }

    async function uploadImage(file) {
        try {
            formState.isCapture = file.captured;

            if (file.captured) {
                // Start location request before upload
                getCoordinates();
            }

            previewContainer.classList.remove('hidden');
            imagePreview.src = '';

            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75';
            loadingDiv.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p class="mt-2 text-gray-700 font-semibold">Uploading image...</p>
                </div>
            `;
            previewContainer.appendChild(loadingDiv);

            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Upload failed');
            }

            loadingDiv.remove();
            imagePreview.src = result.data.url;
            imagePreview.dataset.imgbbUrl = result.data.url;
            imagePreview.dataset.deleteUrl = result.data.delete_url;

            // Update form state
            formState.hasImage = true;
            updateSubmitButton();

            Toast.fire({
                icon: "success",
                title: "Image uploaded successfully"
            });

        } catch (error) {
            console.error('Upload error:', error);
            formState.hasImage = false;
            formState.isCapture = false;
            updateSubmitButton();
            showError('Failed to upload image');
        }
    }

    function showError(message) {
        Toast.fire({
            icon: "error",
            title: message,
            timerProgressBar: false
        });
    }

    function clearImage() {
        imagePreview.src = '';
        imagePreview.dataset.imgbbUrl = '';
        imagePreview.dataset.deleteUrl = '';
        previewContainer.classList.add('hidden');
        coordinatesContainer.classList.add('hidden');
        uploadInput.value = '';
        captureInput.value = '';
        
        // Update form state
        formState.hasImage = false;
        formState.hasLocation = false;
        formState.isCapture = false;
        updateSubmitButton();
    }

    // Modal functions
    function openImageModal(imgSrc) {
        modalImage.src = imgSrc;
        requestAnimationFrame(() => {
            imageModal.style.display = 'flex';
            setTimeout(() => {
                imageModal.style.opacity = '1';
            }, 10);
        });
        document.body.style.overflow = 'hidden';
    }

    function closeImageModal() {
        imageModal.style.opacity = '0';
        setTimeout(() => {
            imageModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Event Listeners
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) uploadImage(file);
    });

    captureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            file.captured = true;
            uploadImage(file);
        }
    });

    clearButton.addEventListener('click', clearImage);

    imagePreview.addEventListener('click', () => {
        if (imagePreview.src) {
            openImageModal(imagePreview.src);
        }
    });

    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeImageModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageModal();
        }
    });

    // Add function to update submit button state
    function updateSubmitButton() {
        const submitButton = form.querySelector('button[type="submit"]');
        const allFieldsFilled = Array.from(form.querySelectorAll('select[required]'))
            .every(select => select.value);
        
        // Location is only required for captured photos
        const isValid = formState.hasImage && 
            (!formState.isCapture || (formState.isCapture && formState.hasLocation)) && 
            allFieldsFilled;
        
        submitButton.disabled = !isValid;
        submitButton.classList.toggle('opacity-50', !isValid);
        submitButton.classList.toggle('cursor-not-allowed', !isValid);

        // Update tooltip message
        let missingItems = [];
        if (!formState.hasImage) missingItems.push('image');
        if (formState.isCapture && !formState.hasLocation) missingItems.push('location');
        if (!allFieldsFilled) missingItems.push('all required fields');

        if (missingItems.length > 0) {
            submitButton.title = `Please complete: ${missingItems.join(', ')}`;
        } else {
            submitButton.title = '';
        }
    }

    // Add event listeners for select fields
    form.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', updateSubmitButton);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Double check validation
        if (!formState.hasImage) {
            Toast.fire({
                title: "Please upload or capture an image",
                icon: "error",
                timerProgressBar: false
            });
            return;
        }

        if (formState.isCapture && !formState.hasLocation) {
            Toast.fire({
                title: "Please allow location access for captured image",
                icon: "error",
                timerProgressBar: false
            });
            return;
        }

        const allFieldsFilled = Array.from(form.querySelectorAll('select[required]'))
            .every(select => select.value);
        
        if (!allFieldsFilled) {
            Toast.fire({
                icon: "error",
                title: "Please fill in all required fields",
                timerProgressBar: false
            });
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
        `;

        try {
            const formData = {
                roadType: form.roadType.value,
                trafficVolume: form.trafficVolume.value,
                distressType: form.distressType.value,
                distressArea: form.distressArea.value,
                distressSeverity: form.distressSeverity.value,
                repairUrgency: form.repairUrgency.value,
                drainageCondition: form.drainageCondition.value,
                accidentHistory: form.accidentHistory.value,
                imageUrl: imagePreview.dataset.imgbbUrl,
                latitude: parseFloat(document.getElementById('latitude').textContent),
                longitude: parseFloat(document.getElementById('longitude').textContent),
                accuracy: parseFloat(document.getElementById('accuracy').textContent)
            };

            const response = await fetch('/submit-survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }

            Toast.fire({
                icon: "success",
                title: "Survey submitted successfully!",
                timerProgressBar: false
            });

            // Short delay before redirect
            setTimeout(() => {
                window.location.href = '/survey';
            }, 1500);

        } catch (error) {
            console.error('Submission error:', error);
            Toast.fire({
                icon: "error",
                title: "Failed to submit survey",
                timerProgressBar: false
            });
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Submit Survey</span>
            `;
        }
    });

    // Initial button state update
    updateSubmitButton();
}); 