class ImageModal {
    constructor(options = {}) {
        this.zIndex = options.zIndex || 9999;
        this.backgroundColor = options.backgroundColor || 'rgba(0, 0, 0, 0.75)';
        this.closeOnClickOutside = options.closeOnClickOutside !== false;
        this.animationDuration = options.animationDuration || 300;
        
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background-color: ${this.backgroundColor};
            z-index: ${this.zIndex};
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            opacity: 0;
            visibility: hidden;
            transition: opacity ${this.animationDuration}ms ease-in-out, visibility ${this.animationDuration}ms ease-in-out;
        `;

        // Create modal content
        const content = document.createElement('div');
        content.className = 'image-modal-content';
        content.style.cssText = `
            position: relative;
            max-width: 56rem;
            width: 100%;
            margin: 2.5rem auto 0;
        `;

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'image-modal-close';
        closeButton.style.cssText = `
            position: absolute;
            top: -1rem;
            right: -1rem;
            background-color: white;
            border-radius: 9999px;
            padding: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            cursor: pointer;
            transition: background-color 200ms ease-in-out;
            z-index: ${this.zIndex + 1};
            border: none;
            outline: none;
        `;
        closeButton.innerHTML = `
            <svg style="width: 1.5rem; height: 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;

        // Create image element
        const img = document.createElement('img');
        img.id = 'modalImage';
        img.style.cssText = `
            width: 100%;
            height: auto;
            max-height: 80vh;
            object-fit: contain;
            border-radius: 0.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            background-color: white;
        `;

        // Assemble modal
        content.appendChild(closeButton);
        content.appendChild(img);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Store elements as properties
        this.modal = modal;
        this.closeButton = closeButton;
        this.image = img;

        // Add hover effect for close button
        closeButton.addEventListener('mouseover', () => {
            closeButton.style.backgroundColor = '#f3f4f6';
        });
        closeButton.addEventListener('mouseout', () => {
            closeButton.style.backgroundColor = 'white';
        });
    }

    setupEventListeners() {
        // Close button click
        this.closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        // Click outside to close
        if (this.closeOnClickOutside) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Prevent scrolling when modal is open
        this.modal.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
    }

    open(imageUrl) {
        return new Promise((resolve) => {
            this.image.src = imageUrl;
            this.modal.style.visibility = 'visible';
            requestAnimationFrame(() => {
                this.modal.style.opacity = '1';
            });
            this.isOpen = true;
            
            this.image.onload = () => resolve();
            this.image.onerror = () => resolve();
        });
    }

    close() {
        this.modal.style.opacity = '0';
        setTimeout(() => {
            this.modal.style.visibility = 'hidden';
            this.image.src = '';
        }, this.animationDuration);
        this.isOpen = false;
    }

    destroy() {
        this.modal.remove();
    }
} 