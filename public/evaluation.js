document.addEventListener('DOMContentLoaded', function () {
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

    const pages = ['page1', 'page2', 'page3', 'page4'];
    let currentPage = 0;
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');

    // Page Navigation Logic
    function showPage(pageIndex) {
        pages.forEach((pageId, index) => {
            document.getElementById(pageId).classList.toggle('hidden', index !== pageIndex);
        });

        prevBtn.classList.toggle('hidden', pageIndex === 0);
        nextBtn.textContent = pageIndex === pages.length - 1 ? 'Submit' : 'Next';
        progressBar.style.width = `${((pageIndex + 1) / pages.length) * 100}%`;
    }

    const form = document.getElementById('evaluationForm');

    // Modified next button click handler
    nextBtn.addEventListener('click', async function () {
        const currentPageElement = document.getElementById(pages[currentPage]);
        const requiredFields = currentPageElement.querySelectorAll('[required]');
        const radioGroups = new Set();
        const answeredGroups = new Set();

        // Check radio buttons
        currentPageElement.querySelectorAll('input[type="radio"]').forEach(radio => {
            radioGroups.add(radio.name);
            if (radio.checked) {
                answeredGroups.add(radio.name);
            }
        });

        let isValid = Array.from(requiredFields).every(field => field.value);
        let allQuestionsAnswered = radioGroups.size === answeredGroups.size;

        if (!isValid) {
            Toast.fire({
                icon: "error",
                title: "Please fill in all required fields",
                timerProgressBar: false
            });
            return;
        }

        if (radioGroups.size > 0 && !allQuestionsAnswered) {
            Toast.fire({
                icon: "error",
                title: "Please answer all questions",
                timerProgressBar: false
            });
            return;
        }

        if (currentPage < pages.length - 1) {
            currentPage++;
            showPage(currentPage);
            window.scrollTo(0, 0);
        } else {
            // Handle form submission
            await submitForm();
        }
    });

    async function submitForm() {
        try {
            // Show loading state
            nextBtn.disabled = true;
            nextBtn.innerHTML = `
                <span class="inline-flex items-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                </span>
            `;

            // Gather form data
            const formData = {
                personalInfo: {
                    fullName: document.querySelector('input[name="fullName"]').value,
                    age: document.querySelector('input[name="age"]').value,
                    institutionType: document.querySelector('select[name="institutionType"]').value,
                    institutionName: document.querySelector('input[name="institutionName"]').value,
                    email: document.querySelector('input[name="email"]').value,
                    phone: document.querySelector('input[name="phone"]').value
                },
                knowledgeResponses: Array.from(document.querySelectorAll(
                    '#knowledgeQuestions #knowledgeQuestion')).map(q => {
                    const checkedRadio = q.querySelector('input[type="radio"]:checked');
                    if (!checkedRadio) {
                        throw new Error('Please answer all knowledge questions');
                    }
                    return {
                        questionId: q.querySelector('input[type="radio"]').name,
                        answer: checkedRadio.value
                    };
                }),
                imageAssessments: Array.from(document.querySelectorAll(
                    '#distressImages #distressImage')).map(img => ({
                    imageId: img.querySelector('img').alt.split(': ')[1],
                    distressType: img.querySelector('#imgDistressType').value,
                    distressLevel: parseInt(img.querySelector('#imgDistressSeverity').value)
                })),
                fieldTest: {
                    imageUrl: imagePreview.dataset.imgbbUrl,
                    latitude: parseFloat(document.getElementById('latitude').textContent),
                    longitude: parseFloat(document.getElementById('longitude').textContent),
                    accuracy: parseFloat(document.getElementById('accuracy').textContent),
                    distressType: document.querySelector('#fieldTestDistressType').value,
                    distressLevel: parseInt(document.querySelector('#fieldTestSeverity').value)
                }
            };

            const response = await fetch('/submit-evaluation', {
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
                title: "Evaluation submitted successfully!",
                timerProgressBar: false
            });

            // Short delay before redirect
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            console.error('Submission error:', error);
            Toast.fire({
                icon: "error",
                title: "Failed to submit evaluation",
                timerProgressBar: false
            });
        } finally {
            nextBtn.disabled = false;
            nextBtn.textContent = 'Submit';
        }
    }

    prevBtn.addEventListener('click', function () {
        if (currentPage > 0) {
            currentPage--;
            showPage(currentPage);
            window.scrollTo(0, 0);
        }
    });

    showPage(0);

    const uploadInput = document.getElementById('uploadInput');
    const captureInput = document.getElementById('captureInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('previewContainer');
    const clearButton = document.getElementById('clearButton');
    const coordinatesContainer = document.getElementById('coordinatesContainer');
    const coordinatesLoading = document.getElementById('coordinatesLoading');
    const coordinatesError = document.getElementById('coordinatesError');
    const coordinates = document.getElementById('coordinates');
    const latitudeSpan = document.getElementById('latitude');
    const longitudeSpan = document.getElementById('longitude');
    const accuracySpan = document.getElementById('accuracy');
    const cordErr = document.getElementById('cordErr');

    // navigator.permissions.query({ name: "geolocation" }).then((result) => {
    //     if (result.state === "granted") {
    //       // now you can use geolocation api
    //     } 
    //   });

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
                    // No need to call updateSubmitButton() as it's not used in evaluation
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
            coordinatesLoading.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    <span class="text-gray-700 font-medium">Getting location... (Attempt ${formState.locationRetries + 1}/${LOCATION_MAX_RETRIES})</span>
                </div>
            `;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function success(position) {
                    latitudeSpan.textContent = position.coords.latitude.toFixed(6);
                    longitudeSpan.textContent = position.coords.longitude.toFixed(6);
                    accuracySpan.textContent = position.coords.accuracy.toFixed(1) + 'm';

                    coordinatesLoading.classList.add('hidden');
                    coordinates.classList.remove('hidden');
                   
                    // Update form state
                    formState.hasLocation = true;

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
    }

    function handleLocationError(message, canRetry = false) {
        coordinatesLoading.classList.add('hidden');
        coordinatesError.classList.remove('hidden');
        cordErr.textContent = message;
        
        formState.hasLocation = false;

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

            // If it's from capture input, get coordinates
            if (file.captured) {
                getCoordinates();
            }
            // Show loading state
            previewContainer.classList.remove('hidden');
            imagePreview.src = ''; // Clear existing preview

            // Add loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className =
                'absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75';
            loadingDiv.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p class="mt-2 text-gray-700 font-semibold">Uploading image...</p>
                </div>
            `;
            previewContainer.appendChild(loadingDiv);

            // Create form data
            const formData = new FormData();
            formData.append('image', file);

            // Upload to server
            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Upload failed');
            }

            // Remove loading indicator
            loadingDiv.remove();

            // Show preview and store URL
            imagePreview.src = result.data.url;
            imagePreview.dataset.imgbbUrl = result.data.url;
            imagePreview.dataset.deleteUrl = result.data.delete_url;

            // Update form state after successful upload
            formState.hasImage = true;

        } catch (error) {
            console.error('Upload error:', error);
            formState.hasImage = false;
            formState.isCapture = false;
            // Show error state
            const errorDiv = document.createElement('div');
            errorDiv.className =
                'absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75';
            errorDiv.innerHTML = `
                <div class="flex flex-col items-center text-red-500">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="mt-2 font-semibold">Failed to upload image</p>
                </div>
            `;
            previewContainer.appendChild(errorDiv);

            // Remove error message after 3 seconds
            setTimeout(() => {
                errorDiv.remove();
                if (!imagePreview.src) {
                    previewContainer.classList.add('hidden');
                }
            }, 3000);
        }
    }

    function handleUploadImage(event) {
        const file = event.target.files[0];
        if (file) {
            uploadImage(file);
        }
    }

    function handleCaptureImage(event) {
        const file = event.target.files[0];
        if (file) {
            file.captured = true; // Mark as captured for coordinate handling
            uploadImage(file);
        }
    }

    function clearImage() {
        imagePreview.src = '';
        imagePreview.dataset.imgbbUrl = '';
        imagePreview.dataset.deleteUrl = '';
        previewContainer.classList.add('hidden');
        coordinatesContainer.classList.add('hidden');
        uploadInput.value = '';
        captureInput.value = '';
        formState.hasImage = false;
        formState.hasLocation = false;
        formState.isCapture = false;
    }

    uploadInput.addEventListener('change', handleUploadImage);
    captureInput.addEventListener('change', handleCaptureImage);
    clearButton.addEventListener('click', clearImage);
});