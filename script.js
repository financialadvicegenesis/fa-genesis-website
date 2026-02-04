// Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', function() {
    AOS.init({
        duration: 1000,
        once: true,
        offset: 100,
        easing: 'ease-in-out'
    });
});

// Smooth Scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navbarHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = target.offsetTop - navbarHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// CTA Button Click Handler
document.querySelector('.cta-button').addEventListener('click', function() {
    const contactSection = document.querySelector('#contact');
    const navbarHeight = document.querySelector('.navbar').offsetHeight;
    const targetPosition = contactSection.offsetTop - navbarHeight;
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
});

// Form Submission Handler
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    e.preventDefault();

    // Get form data
    const formData = {
        nom: document.getElementById('nom').value,
        prenom: document.getElementById('prenom').value,
        email: document.getElementById('email').value,
        profil: document.getElementById('profil').value,
        offre: document.getElementById('offre').value,
        message: document.getElementById('message').value
    };

    // Log form data (in production, you would send this to a server)
    console.log('Form submitted:', formData);

    // Show success message
    alert('Merci pour votre message ! Nous vous contacterons bientôt.');

    // Reset form
    this.reset();
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
    } else {
        navbar.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// Mobile Menu Toggle (for future mobile menu implementation)
const createMobileMenu = () => {
    if (window.innerWidth <= 768) {
        const navLinks = document.querySelector('.nav-links');
        const ctaButton = document.querySelector('.cta-button');

        // Add mobile menu functionality here if needed
        // This is a placeholder for future enhancement
    }
};

// Run on load and resize
window.addEventListener('load', createMobileMenu);
window.addEventListener('resize', createMobileMenu);

// Add active state to navigation links
const sections = document.querySelectorAll('section[id]');
const navLinksList = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinksList.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe all cards
document.querySelectorAll('.card').forEach(card => {
    observer.observe(card);
});

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to scroll handler
const debouncedScroll = debounce(() => {
    // Any expensive scroll operations can go here
}, 100);

window.addEventListener('scroll', debouncedScroll);
