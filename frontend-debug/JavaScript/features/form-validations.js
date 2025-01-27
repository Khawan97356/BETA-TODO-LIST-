// === FORM VALIDATION DEBUGGING TOOLKIT === //

// form-validations.js dépend de
import { DOMManipulationTester, DOMPerformanceChecker } from './dom-manipulation.js';
import { CodeOptimizer, OptimizationUtils } from '../performance/code-optimization.js';




// Classe principale de validation de formulaire
class FormValidator {
    constructor(form) {
        this.form = form;
        this.errors = new Map();
        this.customValidators = new Map();
        this.validateOnInput = true;
        this.domTester = new DOMManipulationTester();
        this.DOMPerformanceChecker = DOMPerformanceChecker;
        this.setupValidation();
    }

    // Amélioration des validateurs communs avec des optimisations
const CommonValidators = {
    email: OptimizationUtils.memoize((value) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return emailRegex.test(value);
    }),
    
    password: OptimizationUtils.memoize((value) => {
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);
        const hasSpecialChar = /[!@#$%^&*]/.test(value);
        return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    }),
    
    phone: OptimizationUtils.memoize((value) => {
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        return phoneRegex.test(value);
    }),
    
    date: OptimizationUtils.memoize((value) => {
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
    }),
    
    url: OptimizationUtils.memoize((value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    })
};

    // Configuration initiale
    setupValidation() {
        OptimizationUtils.debounce(() => {
            this.form.noValidate = true; // Désactive la validation HTML5 native
            this.form.addEventListener('submit', (e) => this.handleSubmit(e)); 

            if (this.validateOnInput) {
                this.form.addEventListener('input', (e) => this.handleInput(e));
                this.form.addEventListener('blur', (e) => this.handleBlur(e), true);
            }
        } , 100);

        this.domTester.takeSnapshot(this.form, 'initial');
            
    }

    // Gestion de la soumission
    handleSubmit(event) {
        event.preventDefault();

        this.performanceChecker.measure(() => {
        this.validateForm();
        } , 'form-validate');
        
        if (this.errors.size === 0) {
            console.log('Form is valid, ready to submit', this.getFormData());

            const changes = this.domTester.compareWithSnapshot(this.form, 'initial');
            console.log('DOM changes:', changes);
        } else {
            this.displayErrors();
            console.warn('Form validation failed:', Array.from(this.errors.entries()));
        }
    }

    validateField(field) {
        return this.performanceChecker.measure(() => {
            const fieldName = field.name;
            this.errors.delete(fieldName);

            this.domTester.takeSnapshot(field, '${fieldName}-before');

            // Validation des attributs HTML5
            if (!field.checkValidity()) {
                this.errors.set(fieldName, this.getValidationMessage(field));
                return false;
            }

            this.updateFieldUI(field, true);

            const changes = this.domTester.compareWithSnapshot(field, '${fieldName}-before');

            console.log('DOM changes:', changes);

            return true;
        }, `validate-${fieldName}`);
            // Validateurs personnalis
        }

        updateFieldUI(field, isValid) {
            // Optimiser les manipulations DOM
            CodeOptimizer.batchDOMUpdates(() => {
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
            });
        }


    // Validation à la saisie
    handleInput(event) {
        const field = event.target;
        if (field.dataset.validateOnInput !== 'false') {
            this.validateField(field);
        }
    }

    // Validation à la perte de focus
    handleBlur(event) {
        const field = event.target;
        this.validateField(field);
    }

    // Ajout de validateurs personnalisés
    addValidator(fieldName, validatorFn, errorMessage) {
        if (!this.customValidators.has(fieldName)) {
            this.customValidators.set(fieldName, []);
        }
        this.customValidators.get(fieldName).push({
            validate: validatorFn,
            message: errorMessage
        });
    }

    // Validation d'un champ spécifique
    validateField(field) {
        const fieldName = field.name;
        this.errors.delete(fieldName);

        // Validation des attributs HTML5
        if (!field.checkValidity()) {
            this.errors.set(fieldName, this.getValidationMessage(field));
            return false;
        }

        // Validateurs personnalisés
        const customValidators = this.customValidators.get(fieldName) || [];
        for (const validator of customValidators) {
            if (!validator.validate(field.value, this.form)) {
                this.errors.set(fieldName, validator.message);
                return false;
            }
        }

        this.updateFieldUI(field, true);
        return true;
    }

    // Validation du formulaire complet
    validateForm() {
        this.errors.clear();
        const fields = this.form.querySelectorAll('input, select, textarea');
        
        fields.forEach(field => {
            this.validateField(field);
        });

        return this.errors.size === 0;
    }

    // Obtenir le message d'erreur approprié
    getValidationMessage(field) {
        if (field.validity.valueMissing) return 'Ce champ est requis';
        if (field.validity.typeMismatch) return 'Format invalide';
        if (field.validity.tooShort) return Minimum ${field.minLength} caractères;
        if (field.validity.tooLong) return Maximum ${field.maxLength} caractères;
        if (field.validity.rangeUnderflow) return Minimum ${field.min};
        if (field.validity.rangeOverflow) return Maximum ${field.max};
        if (field.validity.patternMismatch) return 'Format incorrect';
        return field.validationMessage;
    }

    // Mise à jour de l'interface utilisateur
    updateFieldUI(field, isValid) {
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
    }

    // Affichage des erreurs
    displayErrors() {
        const fields = this.form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            const hasError = this.errors.has(field.name);
            this.updateFieldUI(field, !hasError);
        });
    }

    // Récupération de l'élément d'erreur
    getErrorElement(field) {
        return this.form.querySelector([data-error-for="${field.name}"]);
    }

    // Récupération des données du formulaire
    getFormData() {
        const formData = new FormData(this.form);
        return Object.fromEntries(formData.entries());
    }

    // Réinitialisation du formulaire
    reset() {
        this.form.reset();
        this.errors.clear();
        const fields = this.form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.classList.remove('valid', 'invalid');
            const errorElement = this.getErrorElement(field);
            if (errorElement) errorElement.style.display = 'none';
        });
    }
}

// Validateurs prédéfinis communs
const CommonValidators = {
    email: (value) => {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return emailRegex.test(value);
    },
    
    password: (value) => {
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);
        const hasSpecialChar = /[!@#$%^&*]/.test(value);
        return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    },
    
    phone: (value) => {
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        return phoneRegex.test(value);
    },
    
    date: (value) => {
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
    },
    
    url: (value) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }
};

// Exemple d'utilisation
function createDebugForm() {
    const form = document.createElement('form');
    form.innerHTML = `
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
    `;

    const validator = new FormValidator(form);
    
    // Ajouter des validateurs personnalisés
    validator.addValidator('password', 
        (value) => CommonValidators.password(value),
        'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
    );

    return validator;
}

// Export des utilitaires
export {
    FormValidator,
    CommonValidators,
    createDebugForm
};

// Créer un validateur pour un formulaire existant
// const form = document.querySelector('#myForm');
// const validator = new FormValidator(form);

// Ajouter des validations personnalisées
//validator.addValidator('username', 
   // (value) => value.length >= 3,
   // 'Le nom d\'utilisateur doit contenir au moins 3 caractères'
//);

// Ou utiliser le formulaire de debug
// const debugValidator = createDebugForm();
// document.body.appendChild(debugValidator.form);