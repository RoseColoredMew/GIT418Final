"use strict";

/*
 * Swim n Chill - Main JavaScript
 * Author: Abraham Mendez
 * Date: December 2025
 */

// Wait for DOM to be fully loaded
$(document).ready(function() {
    
    // Initialize all components
    initServiceTabs();
    initGalleryCarousel();
    initThemeToggle();
    loadServiceAreas();
    initServiceAreasMap();
    initContactForm();
    checkReturningVisitor();
    initSmoothScroll();
    
});

/**
 * Initialize jQuery UI Tabs for Services Section
 */
function initServiceTabs() {
    $("#services-tabs").tabs({
        active: 0,
        collapsible: false,
        heightStyle: "content"
    });
}

/**
 * Initialize Slick Carousel for Gallery
 */
function initGalleryCarousel() {
    const $carousel = $(".gallery-carousel");

    if (!$carousel.length) return;

    function updateSlideFocus() {
        $carousel.find('.slick-slide').each(function() {
            const $slide = $(this);
            const isHidden = $slide.attr('aria-hidden') === 'true';
            $slide.attr('tabindex', isHidden ? '-1' : '0');
        });
    }

    $carousel.on('init reInit afterChange', updateSlideFocus);

    $carousel.slick({
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 3000,
        arrows: true,
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 2
                }
            },
            {
                breakpoint: 600,
                settings: {
                    slidesToShow: 1
                }
            }
        ]
    });
}

/**
 * Load Service Areas from JSON using AJAX
 */
function loadServiceAreas() {
    $.ajax({
        url: 'data/service-areas.json',
        method: 'GET',
        dataType: 'json',
        success: function(data) {
            displayServiceAreas(data.areas);
        },
        error: function(xhr, status, error) {
            console.error('Error loading service areas:', error);
            $('#areas-container').html('<p class="error">Unable to load service areas. Please try again later.</p>');
        }
    });
}

/**
 * Display service areas in the DOM
 * @param {Array} areas - Array of service area objects
 */
function displayServiceAreas(areas) {
    const container = $('#areas-container');
    container.empty();
    
    areas.forEach(function(area) {
        const zipLine = area.zipCodes ? `<p>${area.zipCodes}</p>` : "";
        const areaCard = `
            <div class="area-card">
                <h3>${area.city}</h3>
                ${zipLine}
            </div>
        `;
        container.append(areaCard);
    });
}

/**
 * Initialize Leaflet map and plot service areas.
 * - Fetches `data/service-areas.json` and uses lat/lng if available
 * - Falls back to Nominatim geocoding for missing coordinates (cached in localStorage)
 */
function initServiceAreasMap() {
    // Ensure Leaflet is available and map container exists
    if (typeof L === 'undefined') {
        // Leaflet not loaded yet (scripts deferred) — try again shortly
        setTimeout(initServiceAreasMap, 250);
        return;
    }

    const mapContainer = document.getElementById('areas-map');
    if (!mapContainer) return;

    // Default center until markers are added
    const map = L.map('areas-map', { scrollWheelZoom: false }).setView([33.4484, -112.0740], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const geocacheKey = 'swimnchill_geocache_v1';
    let geocache = {};
    try { geocache = JSON.parse(localStorage.getItem(geocacheKey) || '{}'); } catch (e) { geocache = {}; }

    const markers = [];

    // Helper to add a marker and popup
    function addMarker(lat, lon, title, details) {
        const marker = L.marker([lat, lon]).addTo(map);
        const popup = `<strong>${title}</strong>${details ? '<br>' + details : ''}`;
        marker.bindPopup(popup);
        markers.push(marker);
    }

    // Fit map to markers if any
    function fitToMarkers() {
        if (!markers.length) return;
        try {
            const group = L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.2));
        } catch (e) {
            console.warn('Could not fit map bounds:', e);
        }
    }

    // Load areas and either plot coordinates or queue for geocoding
    fetch('data/service-areas.json').then(function(resp) {
        return resp.json();
    }).then(function(data) {
        const areas = data.areas || [];
        const geocodeQueue = [];

        areas.forEach(function(area) {
            const city = area.city || '';
            const details = area.zipCodes ? area.zipCodes : '';

            if (area.latitude && area.longitude) {
                addMarker(parseFloat(area.latitude), parseFloat(area.longitude), city, details);
            } else if (geocache[city]) {
                const cached = geocache[city];
                addMarker(parseFloat(cached.lat), parseFloat(cached.lon), city, cached.display_name || details);
            } else {
                geocodeQueue.push({ city: city, details: details });
            }
        });

        // Process geocode queue with a small delay to respect Nominatim usage
        function processQueue() {
            if (!geocodeQueue.length) {
                // No more to geocode; fit map
                fitToMarkers();
                // Persist any cache changes
                try { localStorage.setItem(geocacheKey, JSON.stringify(geocache)); } catch (e) {}
                return;
            }

            const item = geocodeQueue.shift();
            const query = item.city + ', Arizona';
            const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);

            fetch(url, { headers: { 'Accept-Language': 'en-US' } }).then(function(r) { return r.json(); }).then(function(results) {
                if (results && results.length) {
                    const r0 = results[0];
                    geocache[item.city] = { lat: r0.lat, lon: r0.lon, display_name: r0.display_name };
                    addMarker(parseFloat(r0.lat), parseFloat(r0.lon), item.city, r0.display_name || item.details);
                } else {
                    console.warn('No geocode result for', item.city);
                }
            }).catch(function(err) {
                console.warn('Geocoding error for', item.city, err);
            }).finally(function() {
                // Wait 1.2s before next request
                setTimeout(processQueue, 1200);
            });
        }

        // Start processing queue, and fit now if there are already markers
        if (markers.length) fitToMarkers();
        if (geocodeQueue.length) processQueue();
    }).catch(function(err) {
        console.error('Error loading service areas for map:', err);
    });
}

/**
 * Initialize Theme Toggle with localStorage
 */
function initThemeToggle() {
    const themeToggle = $('#theme-toggle');
    const iconMoon = $('#icon-moon');
    const iconSun = $('#icon-sun');
    const STORAGE_KEY = 'swimnchillTheme';

    if (!themeToggle.length) return;

    // Determine initial theme: saved preference or system preference
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? (saved === 'dark') : prefersDark;

    function applyTheme(dark) {
        if (dark) {
            $('body').addClass('dark-theme');
            themeToggle.attr('aria-pressed', 'true');
            iconMoon.hide();
            iconSun.show();
        } else {
            $('body').removeClass('dark-theme');
            themeToggle.attr('aria-pressed', 'false');
            iconMoon.show();
            iconSun.hide();
        }
    }

    applyTheme(isDark);

    // Toggle theme on button click and persist
    themeToggle.on('click', function() {
        const nowDark = $('body').toggleClass('dark-theme').hasClass('dark-theme');
        applyTheme(nowDark);
        localStorage.setItem(STORAGE_KEY, nowDark ? 'dark' : 'light');
    });
}

/**
 * Initialize Contact Form with validation and localStorage
 */
function initContactForm() {
    $('#contact-form').on('submit', function(e) {
        e.preventDefault();
        
        const name = $('#name').val();
        const email = $('#email').val();
        const phone = $('#phone').val();
        const message = $('#message').val();
        
        // Validate form fields
        if (!name || !email || !message) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Save visitor info to localStorage
        const visitorData = {
            name: name,
            email: email,
            lastVisit: new Date().toISOString()
        };
        
        localStorage.setItem('swimnchillVisitor', JSON.stringify(visitorData));
        
        // Show success message
        alert(`Thank you, ${name}! We've received your message and will contact you soon.`);
        
        // Reset form
        this.reset();
        
        // Show returning visitor message
        displayReturningVisitorMessage(name);
    });
}

/**
 * Check if user is a returning visitor
 */
function checkReturningVisitor() {
    const visitorData = localStorage.getItem('swimnchillVisitor');
    
    if (visitorData) {
        const visitor = JSON.parse(visitorData);
        displayReturningVisitorMessage(visitor.name);
    }
}

/**
 * Display welcome message for returning visitors
 * @param {string} name - Visitor's name
 */
function displayReturningVisitorMessage(name) {
    const messageDiv = $('#returning-visitor-message');
    messageDiv.html(`Welcome back, ${name}! We're glad to see you again.`);
    messageDiv.addClass('show');
}

/**
 * Initialize smooth scrolling for navigation links
 */
function initSmoothScroll() {
    $('a[href^="#"]').on('click', function(e) {
        const target = $(this.getAttribute('href'));
        
        if (target.length) {
            e.preventDefault();
            $('html, body').stop().animate({
                scrollTop: target.offset().top - 80
            }, 800);
        }
    });
}
