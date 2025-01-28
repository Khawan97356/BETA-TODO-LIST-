// === FORM VALIDATION DEBUGGING TOOLKIT === //

import { DOMManipulationTester, DOMPerformanceChecker } from './dom-manipulation.js';
import { CodeOptimizer, OptimizationUtils } from '../performance/code-optimization.js';

// Initialisation des outils
const optimizer = new CodeOptimizer();
const domTester = new DOMManipulationTester();

// Classe principale de validation de formulaire
class FormValidator {
    constructor(form) {
        this.form = form;
        this.errors = new Map();
        this.customValidators = new Map();
        this.validateOnInput = true;

        // Initialisation des outils de performance et d'optimisation
        this.optimizer = optimizer;
        this.domTester = domTester;
        
        // Optimisation des méthodes avec debounce/throttle
        this.debouncedValidation = OptimizationUtils.debounce(
            this.validateField.bind(this),
            250
        );

        this.throttledUIUpdate = OptimizationUtils.throttle(
            this.updateFieldUI.bind(this),
            100
        );

        // Mémoïsation des validateurs communs
        Object.entries(CommonValidators).forEach(([name, validator]) => {
            CommonValidators[name] = OptimizationUtils.memoize(validator);
        });

        this.setupValidation();
    }

    setupValidation() {
        DOMPerformanceChecker.measure(() => {
            // Snapshot initial pour le suivi des modifications
            this.domTester.takeSnapshot(this.form, 'initialFormState');
            
            this.form.noValidate = true;
            
            // Utilisation de la délégation d'événements
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            
            if (this.validateOnInput) {
                this.form.addEventListener('input', (e) => {
                    if (e.target.matches('input, select, textarea')) {
                        this.debouncedValidation(e.target);
                    }
                });

                this.form.addEventListener('blur', (e) => {
                    if (e.target.matches('input, select, textarea')) {
                        this.validateField(e.target);
                    }
                }, true);
            }
        }, 'Form validation setup');
    }

    handleSubmit(event) {
        event.preventDefault();
        
        DOMPerformanceChecker.measure(() => {
            this.validateForm();
            
            if (this.errors.size === 0) {
                console.log('Form is valid, ready to submit', this.getFormData());
                
                // Vérifier les changements depuis l'état initial
                const changes = this.domTester.compareWithSnapshot(this.form, 'initialFormState');
                console.log('Form changes:', changes);
            } else {
                this.displayErrors();
                console.warn('Form validation failed:', Array.from(this.errors.entries()));
            }
        }, 'Form submission handling');
    }

    validateField(field) {
        return DOMPerformanceChecker.measure(() => {
            const fieldName = field.name;
            this.errors.delete(fieldName);

            // Prendre un snapshot avant la validation
            this.domTester.takeSnapshot(field, `${fieldName}-preValidation`);

            // Validation HTML5
            if (!field.checkValidity()) {
                this.errors.set(fieldName, this.getValidationMessage(field));
                this.throttledUIUpdate(field, false);
                return false;
            }

            // Validateurs personnalisés
            const customValidators = this.customValidators.get(fieldName) || [];
            for (const validator of customValidators) {
                if (!validator.validate(field.value, this.form)) {
                    this.errors.set(fieldName, validator.message);
                    this.throttledUIUpdate(field, false);
                    return false;
                }
            }

            this.throttledUIUpdate(field, true);

            // Comparer avec le snapshot
            const changes = this.domTester.compareWithSnapshot(field, `${fieldName}-preValidation`);
            console.debug(`Field validation changes (${fieldName}):`, changes);

            return true;
        }, `Field validation: ${field.name}`);
    }

    validateForm() {
        return DOMPerformanceChecker.measure(() => {
            this.errors.clear();
            const fields = this.form.querySelectorAll('input, select, textarea');
            
            fields.forEach(field => {
                this.validateField(field);
            });

            // Générer un rapport d'optimisation
            const report = this.optimizer.generateReport(this.form.innerHTML);
            console.debug('Form optimization report:', report);

            return this.errors.size === 0;
        }, 'Complete form validation');
    }

    updateFieldUI(field, isValid) {
        DOMPerformanceChecker.measure(() => {
            // Snapshot avant mise à jour UI
            this.domTester.takeSnapshot(field, `${field.name}-preUI`);

            const errorElement = this.getErrorElement(field);
            
            if (isValid) {
                field.classList.remove('invalid');
                field.classList.add('valid');
                if (errorElement) errorElement.style.display = 'none';
            } else {
                field.classList.remove('valid');
                field.classList.add('invalid');
                if (errorElement) {
                    errorElement.textContent = this.errors.get(field.name);
                    errorElement.style.display = 'block';
                }
            }

            // Vérifier les changements UI
            const changes = this.domTester.compareWithSnapshot(field, `${field.name}-preUI`);
            console.debug(`UI update changes (${field.name}):`, changes);
        }, `UI update: ${field.name}`);
    }

    getValidationMessage(field) {
        return DOMPerformanceChecker.measure(() => {
            if (field.validity.valueMissing) return 'Ce champ est requis';
            if (field.validity.typeMismatch) return 'Format invalide';
            if (field.validity.tooShort) return `Minimum ${field.minLength} caractères`;
            if (field.validity.tooLong) return `Maximum ${field.maxLength} caractères`;
            if (field.validity.rangeUnderflow) return `Minimum ${field.min}`;
            if (field.validity.rangeOverflow) return `Maximum ${field.max}`;
            if (field.validity.patternMismatch) return 'Format incorrect';
            return field.validationMessage;
        }, 'Get validation message');
    }

    addValidator(fieldName, validatorFn, errorMessage) {
        // Optimiser le validateur avec mémoïsation
        const optimizedValidator = OptimizationUtils.memoize(validatorFn);
        
        if (!this.customValidators.has(fieldName)) {
            this.customValidators.set(fieldName, []);
        }
        
        this.customValidators.get(fieldName).push({
            validate: optimizedValidator,
            message: errorMessage
        });

        // Analyser le validateur pour optimisations
        const report = this.optimizer.generateReport(validatorFn.toString());
        console.debug(`Validator optimization report (${fieldName}):`, report);
    }

    getErrorElement(field) {
        return this.form.querySelector(`[data-error-for="${field.name}"]`);
    }

    getFormData() {
        return DOMPerformanceChecker.measure(() => {
            const formData = new FormData(this.form);
            return Object.fromEntries(formData.entries());
        }, 'Get form data');
    }

    reset() {
        DOMPerformanceChecker.measure(() => {
            // Snapshot avant reset
            this.domTester.takeSnapshot(this.form, 'preReset');
            
            this.form.reset();
            this.errors.clear();
            
            const fields = this.form.querySelectorAll('input, select, textarea');
            fields.forEach(field => {
                field.classList.remove('valid', 'invalid');
                const errorElement = this.getErrorElement(field);
                if (errorElement) errorElement.style.display = 'none';
            });

            // Vérifier les changements après reset
            const changes = this.domTester.compareWithSnapshot(this.form, 'preReset');
            console.debug('Reset changes:', changes);
        }, 'Form reset');
    }

    // Méthodes d'optimisation
    getOptimizationReport() {
        return this.optimizer.generateReport(this.form.innerHTML);
    }

    getPerformanceMetrics() {
        return DOMPerformanceChecker.getMeasurements();
    }
}

// Validateurs communs optimisés
const CommonValidators = {
    email: (value) => {
        return DOMPerformanceChecker.measure(() => {
            const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
            return emailRegex.test(value);
        }, 'Email validation');
    },
    
    password: (value) => {
        return DOMPerformanceChecker.measure(() => {
            const hasUpperCase = /[A-Z]/.test(value);
            const hasLowerCase = /[a-z]/.test(value);
            const hasNumbers = /\d/.test(value);
            const hasSpecialChar = /[!@#$%^&*]/.test(value);
            return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
        }, 'Password validation');
    },
    
    phone: (value) => {
        return DOMPerformanceChecker.measure(() => {
            const phoneRegex = /^\+?[\d\s-]{10,}$/;
            return phoneRegex.test(value);
        }, 'Phone validation');
    },
    
    date: (value) => {
        return DOMPerformanceChecker.measure(() => {
            const date = new Date(value);
            return date instanceof Date && !isNaN(date);
        }, 'Date validation');
    },
    
    url: (value) => {
        return DOMPerformanceChecker.measure(() => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        }, 'URL validation');
    }
};

// Fonction de création de formulaire de debug optimisée
function createDebugForm() {
    return DOMPerformanceChecker.measure(() => {
        const form = document.createElement('form');
        
        // Utiliser l'optimiseur pour le HTML du formulaire
        const formHTML = optimizer.optimizeCode(`
            <div>
                <label for="email">Email:</label>
                <input type="email" name="email" required>
                <div data-error-for="email"></div>
            </div>
            <div>
                <label for="password">Password:</label>
                <input type="password" name="password" required>
                <div data-error-for="password"></div>
            </div>
            <button type="submit">Submit</button>
        `);

        form.innerHTML = formHTML;

        const validator = new FormValidator(form);
        
        // Ajouter des validateurs optimisés
        validator.addValidator('password', 
            CommonValidators.password,
            'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
        );

        return validator;
    }, 'Debug form creation');
}

// Export des utilitaires
export {
    FormValidator,
    CommonValidators,
    createDebugForm
};